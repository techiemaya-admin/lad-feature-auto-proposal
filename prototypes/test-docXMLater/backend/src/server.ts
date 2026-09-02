import { app } from "./app.js"

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5001

app.listen(PORT, () => {
  console.log(`[docXMLater Backend] Server running on http://localhost:${PORT}`)
})
