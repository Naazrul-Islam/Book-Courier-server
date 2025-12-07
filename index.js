const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config()

const { MongoClient, ServerApiVersion } = require('mongodb')
const port = process.env.PORT || 3000

app.use(express.json())
app.use(cors())

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.c0vwcej.mongodb.net/?appName=Cluster0`

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
})

async function run() {
  try {
    await client.connect()

    const db = client.db("bookCourier")
    const booksCollection = db.collection("books")

    await client.db("admin").command({ ping: 1 })
    console.log("Connected to MongoDB!")

    // Get all books
    app.get("/books", async (req, res) => {
      const result = await booksCollection.find().toArray()
      res.send(result)
    })

    // 
    //  Add New Book (POST API)
    app.post("/books", async (req, res) => {
      try {
        const newBook = req.body;
        const result = await booksCollection.insertOne(newBook);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to add book" });
      }
    });

  } catch (error) {
    console.log(error)
  }
}

run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Bookcourier Server!')
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
