import { Client } from "@notionhq/client"
import dotenv from "dotenv"
import { Tasks } from "./tasks"

dotenv.config()

async function connect() {
  return new Client({
    auth: process.env.NOTION_TOKEN,
  })
}

connect()
  .then((notion) => {
    const tasks = new Tasks(notion)
    tasks.start()
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })