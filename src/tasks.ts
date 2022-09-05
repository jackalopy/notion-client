import { Client } from '@notionhq/client'

export class Tasks {
  private databaseId: string
  private notion: Client
  private now: Date = new Date()
  private fromDate: Date = new Date()
  private intervalLength: number = 10000
  private timeWindow: number = 120000
  private interval: NodeJS.Timer | null = null
  private doneDateTitle: string = 'Done Date'
  private doneTitle: string = 'Done'
  private canceledTitle: string = 'Canceled'
  private archivedTitle: string = 'Archived'
  private statusTitle: string = 'Status'

  constructor(notion: Client) {
    this._updateTime()
    this.notion = notion
    this.databaseId = process.env.NOTION_TASK_DB || ''
    
    if (!this.databaseId) throw 'NOTION_TASK_DB not defined on .env variable'

    this._intervalFunction = this._intervalFunction.bind(this)
  }

  private _updateTime () {
    this.now = new Date()
    this.fromDate = new Date(this. now.getTime() - this.timeWindow)
  }

  private _intervalFunction () {
    this._updateTime()

    this.verifyDoneTasks()
    this.verifyUndoneTasks()
  }
  
  private _dateFormatter(date: Date | string): string {
    if (typeof date === 'string') date = new Date(date)
    
    date = date.toLocaleString(process.env.DATE_FORMAT, {
      timeZone: process.env.TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })

    const [day, month, year] = date.split('/')
    date = `${year}-${month}-${day}`
    return date
  }

  start () {
    if (this.interval) throw 'first stop the last scheduler'

    this.interval = setInterval(this._intervalFunction, this.intervalLength)
    this._intervalFunction()
  }

  stop () {
    if (!this.interval) throw 'first start a scheduler' 

    clearInterval(this.interval)
    this.interval = null
  }

  async verifyDoneTasks () {
    const response = await this.notion.databases.query({
      database_id: this.databaseId,
      filter: {
        and: [{
          or: [{
            property: this.statusTitle,
            status: {
              equals: this.doneTitle
            }
          }, {
            property: this.statusTitle,
            status: {
              equals: this.archivedTitle
            }
          }, {
            property: this.statusTitle,
            status: {
              equals: this.canceledTitle
            }
          }],
        }, {
          timestamp: 'last_edited_time',
          last_edited_time: {
            after: this.fromDate.toISOString()
          }
        }, {
          property: this.doneDateTitle,
          date: {
            is_empty: true
          }
        }]
      }
    })
  
    if (response.object !== 'list') throw 'response should be a list'
    
    const results = response.results
    if (!results || !Array.isArray(results)) throw 'result is not an array'
  
    results.forEach(async (result: any) => {
      if(result.object === 'page')
      console.log('setting:', result.properties.Name.title[0].plain_text, result.id)
      await this.notion.pages.update({
        page_id: result.id,
        properties: {
          [this.doneDateTitle]: {
            date: {
              start: this._dateFormatter(result.last_edited_time)
            }
          }
        }
      })
    })
  }

  async verifyUndoneTasks () {
    const response = await this.notion.databases.query({
      database_id: this.databaseId,
      filter: {
        and: [{
          and: [{
            property: this.statusTitle,
            status: {
              does_not_equal: this.doneTitle
            }
          }, {
            property: this.statusTitle,
            status: {
              does_not_equal: this.archivedTitle
            }
          }, {
            property: this.statusTitle,
            status: {
              does_not_equal: this.canceledTitle
            }
          }],
        }, {
          timestamp: 'last_edited_time',
          last_edited_time: {
            after: this.fromDate.toISOString()
          }
        }, {
          property: this.doneDateTitle,
          date: {
            is_not_empty: true
          }
        }]
      }
    })
  
    if (response.object !== 'list') throw 'response should be a list'
    
    const results = response.results
    if (!results || !Array.isArray(results)) throw 'result is not an array'
  
    results.forEach(async (result: any) => {
      if(result.object === 'page')
      console.log('removing:', result.properties.Name.title[0].plain_text, result.id)
      await this.notion.pages.update({
        page_id: result.id,
        properties: {
          [this.doneDateTitle]: {
            date: null
          }
        }
      })
    })
  }
}