import { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import mondaySdk from 'monday-sdk-js'

type BoardItem = {
  created_at: string
  column_values: Array<{
    id: string
    text: string
    value: string | null
    column: {
      id: string
      title: string
      type: string
    }
  }>
}

type BoardData = {
  boardName: string
  totalLeads: number
  leadsThisWeek: number
  activeOutreach: number
  converted: number
  leadSources: Record<string, number>
  outreachStatus: Record<string, number>
  industries: Record<string, number>
  weeklyActivity: Array<{ label: string; count: number }>
}

const monday = mondaySdk()
const providedBoardId = Number(import.meta.env.VITE_MONDAY_BOARD_ID || 7045235564)
const useLocalApi = import.meta.env.VITE_USE_LOCAL_API === 'true'
const localApiUrl = import.meta.env.VITE_LOCAL_API_URL || 'http://127.0.0.1:8787'
const sourceColumnId = import.meta.env.VITE_SOURCE_COLUMN_ID?.trim()
const statusColumnId = import.meta.env.VITE_STATUS_COLUMN_ID?.trim()
const industryColumnId = import.meta.env.VITE_INDUSTRY_COLUMN_ID?.trim()
const convertedStatusValues: string[] = (import.meta.env.VITE_CONVERTED_STATUS_VALUES || 'converted,won,closed')
  .split(',')
  .map((value: string) => value.trim().toLowerCase())
  .filter(Boolean)

const MOCK_DATA: BoardData = {
  boardName: 'BizDev Pipeline',
  totalLeads: 93,
  leadsThisWeek: 14,
  activeOutreach: 68,
  converted: 0,
  leadSources: {
    Default: 47,
    'Personal Contact': 15,
    'Client Reconnect': 13,
    'Cold Lead': 10,
    'Contact Reconnect': 4,
    'LinkedIn Only': 3,
    '5 Faves': 1,
  },
  outreachStatus: {
    Contacted: 66,
    Default: 7,
    'Meeting Scheduled': 5,
    'Idea Generation': 3,
    'LinkedIn Connect': 2,
    'Interested, not ready': 2,
    'Asked for Referral': 1,
    'No Go': 1,
  },
  industries: {
    'Consumer Packaged Goods': 2,
    Venture: 1,
    PE: 1,
    Nonprofit: 4,
    Healthcare: 1,
    'Home Furnishings': 1,
    Government: 1,
    Packaging: 1,
    'Oil and Gas': 1,
    Finance: 2,
  },
  weeklyActivity: [
    { label: 'Dec 28', count: 0 },
    { label: 'Jan 4', count: 0 },
    { label: 'Jan 11', count: 0 },
    { label: 'Jan 18', count: 1 },
    { label: 'Jan 25', count: 8 },
    { label: 'Feb 1', count: 14 },
    { label: 'Feb 8', count: 48 },
    { label: 'Feb 15', count: 15 },
  ],
}

function findColumnByKeyword(item: BoardItem, keywords: string[]): string {
  const lowerKeywords = keywords.map((keyword) => keyword.toLowerCase())
  const column = item.column_values.find((value) => {
    const title = value.column.title.toLowerCase()
    return lowerKeywords.some((keyword) => title.includes(keyword))
  })

  return column?.text?.trim() || ''
}

function findColumnValue(item: BoardItem, columnId: string | undefined, keywords: string[]): string {
  if (columnId) {
    const column = item.column_values.find((value) => value.id === columnId)
    if (column?.text?.trim()) {
      return column.text.trim()
    }
  }

  return findColumnByKeyword(item, keywords)
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date)
  const day = copy.getDay()
  const diff = copy.getDate() - day
  copy.setDate(diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function parseBoardData(boardName: string, items: BoardItem[]): BoardData {
  const now = new Date()
  const weekStart = startOfWeek(now)
  const leadSources: Record<string, number> = {}
  const outreachStatus: Record<string, number> = {}
  const industries: Record<string, number> = {}
  const weeklyBuckets: Record<string, number> = {}

  for (let index = 7; index >= 0; index -= 1) {
    const bucketDate = new Date(weekStart)
    bucketDate.setDate(bucketDate.getDate() - index * 7)
    const key = bucketDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    weeklyBuckets[key] = 0
  }

  let leadsThisWeek = 0
  let activeOutreach = 0
  let converted = 0

  for (const item of items) {
    const source = findColumnValue(item, sourceColumnId, ['source', 'contact type']) || 'Default'
    const status = findColumnValue(item, statusColumnId, ['status', 'outreach']) || 'Default'
    const industry = findColumnValue(item, industryColumnId, ['industry']) || 'Unknown'

    leadSources[source] = (leadSources[source] || 0) + 1
    outreachStatus[status] = (outreachStatus[status] || 0) + 1
    industries[industry] = (industries[industry] || 0) + 1

    const createdAt = new Date(item.created_at)
    if (createdAt >= weekStart) {
      leadsThisWeek += 1
    }

    const statusLower = status.toLowerCase()
    const isConverted = convertedStatusValues.some((value: string) => statusLower.includes(value))
    if (!isConverted) {
      activeOutreach += 1
    } else {
      converted += 1
    }

    const itemWeek = startOfWeek(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (weeklyBuckets[itemWeek] !== undefined) {
      weeklyBuckets[itemWeek] += 1
    }
  }

  const topIndustries = Object.entries(industries)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .reduce<Record<string, number>>((accumulator, [name, count]) => {
      accumulator[name] = count
      return accumulator
    }, {})

  return {
    boardName,
    totalLeads: items.length,
    leadsThisWeek,
    activeOutreach,
    converted,
    leadSources,
    outreachStatus,
    industries: topIndustries,
    weeklyActivity: Object.entries(weeklyBuckets).map(([label, count]) => ({ label, count })),
  }
}

function App() {
  const [dashboardData, setDashboardData] = useState<BoardData>(MOCK_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (useLocalApi) {
      void loadBoardData(providedBoardId)
      return
    }

    monday.listen('context', async (response) => {
      const contextData = response.data as { boardIds?: number[] } | undefined
      const boardId = contextData?.boardIds?.[0] || providedBoardId
      await loadBoardData(boardId)
    })

    void loadBoardData(providedBoardId)
  }, [])

  const loadBoardData = async (boardId: number) => {
    setLoading(true)
    setError('')

    const query = `
      query ($boardId: [ID!]) {
        boards(ids: $boardId) {
          name
          items_page(limit: 500) {
            items {
              created_at
              column_values {
                id
                text
                value
                column {
                  id
                  title
                  type
                }
              }
            }
          }
        }
      }
    `

    try {
      if (useLocalApi) {
        const response = await fetch(`${localApiUrl}/board-data?boardId=${boardId}`)
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.error || 'Local API request failed')
        }

        setDashboardData(parseBoardData(payload.name, payload.items || []))
        return
      }

      const response = await monday.api(query, { variables: { boardId: [boardId] } })
      const board = response.data?.boards?.[0]

      if (!board) {
        throw new Error('Board not found')
      }

      const items = board.items_page?.items || []
      setDashboardData(parseBoardData(board.name, items))
    } catch {
      setError('Using mock data. Add board permissions in monday app settings to load live data.')
      setDashboardData(MOCK_DATA)
    } finally {
      setLoading(false)
    }
  }

  const leadSourcesOption = useMemo(
    () => ({
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, icon: 'circle' },
      series: [
        {
          name: 'Lead Sources',
          type: 'pie',
          radius: ['50%', '75%'],
          center: ['50%', '45%'],
          label: { show: true, formatter: '{c}' },
          itemStyle: { borderRadius: 2 },
          data: Object.entries(dashboardData.leadSources).map(([name, value]) => ({ name, value })),
        },
      ],
    }),
    [dashboardData.leadSources],
  )

  const outreachOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'value' },
      yAxis: {
        type: 'category',
        data: Object.keys(dashboardData.outreachStatus),
      },
      series: [
        {
          type: 'bar',
          data: Object.values(dashboardData.outreachStatus),
          barWidth: 14,
          itemStyle: {
            color: '#f3a6a4',
            borderRadius: [0, 8, 8, 0],
          },
        },
      ],
      grid: { left: 120, right: 20, top: 20, bottom: 20 },
    }),
    [dashboardData.outreachStatus],
  )

  const industriesOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: Object.keys(dashboardData.industries),
        axisLabel: { rotate: 40 },
      },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'bar',
          data: Object.values(dashboardData.industries),
          itemStyle: {
            color: '#f3a6a4',
            borderRadius: [6, 6, 0, 0],
          },
        },
      ],
      grid: { left: 40, right: 10, bottom: 80, top: 20 },
    }),
    [dashboardData.industries],
  )

  const weeklyOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: dashboardData.weeklyActivity.map((point) => point.label),
      },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'line',
          smooth: true,
          areaStyle: { color: 'rgba(243,166,164,0.18)' },
          lineStyle: { color: '#f3a6a4', width: 3 },
          itemStyle: { color: '#f3a6a4' },
          data: dashboardData.weeklyActivity.map((point) => point.count),
        },
      ],
      grid: { left: 40, right: 20, top: 20, bottom: 40 },
    }),
    [dashboardData.weeklyActivity],
  )

  return (
    <main className="page">
      <header className="header">
        <h1>{dashboardData.boardName}</h1>
        <div className="pill">BizDev Analytics</div>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-value">{dashboardData.totalLeads}</div>
          <div className="kpi-label">Total Leads</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{dashboardData.leadsThisWeek}</div>
          <div className="kpi-label">Leads This Week</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{dashboardData.activeOutreach}</div>
          <div className="kpi-label">Active Outreach</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{dashboardData.converted}</div>
          <div className="kpi-label">Converted</div>
        </div>
      </section>

      <section className="charts-grid">
        <article className="chart-card">
          <h2>Lead Sources</h2>
          <p>Distribution by contact type</p>
          <ReactECharts option={leadSourcesOption} style={{ height: 320 }} />
        </article>

        <article className="chart-card">
          <h2>Outreach Effectiveness</h2>
          <p>Status distribution</p>
          <ReactECharts option={outreachOption} style={{ height: 320 }} />
        </article>

        <article className="chart-card">
          <h2>Industry Trends</h2>
          <p>Top 10 industries</p>
          <ReactECharts option={industriesOption} style={{ height: 320 }} />
        </article>
      </section>

      <section className="chart-card chart-wide">
        <h2>Outreach Activity by Week</h2>
        <p>Last 8 weeks</p>
        <ReactECharts option={weeklyOption} style={{ height: 320 }} />
      </section>

      {loading && <div className="loading">Loading board data…</div>}
    </main>
  )
}

export default App
