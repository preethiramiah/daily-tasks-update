const express = require('express')
const cors = require('cors')
const { google } = require('googleapis')
require('dotenv').config()

const corsOptions = {
  credentials: true,
  origin: ['http://localhost:3000', 'http://localhost:8081']
}

const app = express()
app.use(express.json())
app.use(cors(corsOptions))

const auth = new google.auth.JWT({
  email: process.env.CLIENT_EMAIL,
  key: process.env.PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

const sheets = google.sheets({ version: 'v4', auth })

app.post('/update-sheet', async (req, res) => {
  const { spreadsheetId, sheetId, range, date, tasks } = req.body

  if (!spreadsheetId || !range || !date || !tasks) {
    return res.status(400).json({ error: 'Missing required fields: spreadsheetId, range, tasks or date' })
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    })

    const rows = response.data.values

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'No data found in the sheet' })
    }

    const headers = rows[0].slice(1)

    const rowIndex = rows.findIndex((row) => new Date(row[0]).toLocaleDateString() === new Date(date).toLocaleDateString())

    if (rowIndex === -1) {
      return res.status(404).json({ error: `No data found for the date: ${date}` })
    }

    const requests = headers.map((task, index) => ({
      updateCells: {
        range: {
          sheetId,
          startRowIndex: rowIndex,
          endRowIndex: rowIndex + 1,
          startColumnIndex: index + 1,
          endColumnIndex: index + 2,
        },
        rows: [
          {
            values: [
              {
                userEnteredValue: {
                  boolValue: tasks[task],
                },
              },
            ],
          },
        ],
        fields: 'userEnteredValue',
      },
    }))

    const updateResponse = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests,
      },
    });

    res.status(200).json({ message: 'Sheet updated successfully', data: updateResponse.data })
  } catch (error) {
    console.error('Error updating sheet:', error)
    res.status(500).json({ error: 'Failed to update sheet', details: error.message })
  }
})

app.get('/get-tasks-by-date', async (req, res) => {
  const { spreadsheetId, range, date } = req.query

  if (!spreadsheetId || !date) {
    return res.status(400).json({ error: 'Missing required query parameters: spreadsheetId or date' })
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    })

    const rows = response.data.values

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'No data found in the sheet' })
    }

    const headers = rows[0].slice(1)

    const rowForDate = rows.find((row) => new Date(row[0]).toLocaleDateString() === new Date(date).toLocaleDateString())

    if (!rowForDate) {
      return res.status(404).json({ error: `No data found for the date: ${date}` })
    }

    const tasks = rowForDate.slice(1)

    const result = {}
    headers.forEach((task, index) => {
      result[task] = tasks[index] === 'TRUE'
    })

    res.status(200).json(result)
  } catch (error) {
    console.error('Error fetching sheet data:', error)
    res.status(500).json({ error: 'Failed to fetch sheet data', details: error.message })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})