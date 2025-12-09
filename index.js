const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb'); 
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.c0vwcej.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("bookCourier");
    const booksCollection = db.collection("books");

    console.log("Connected to MongoDB!");

    // GET all books
    app.get("/books", async (req, res) => {
      const status = req.query.status;
      const query = status ? { status } : {};
      const result = await booksCollection.find(query).toArray();
      res.send(result);
    });

    // GET single book
    app.get("/books/:id", async (req, res) => {
      const id = req.params.id;
      const result = await booksCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // POST add new book
    app.post("/books", async (req, res) => {
      try {
        const newBook = req.body;
        const result = await booksCollection.insertOne(newBook);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to add book" });
      }
    });

    // PUT update book
    app.put("/books/:id", async (req, res) => {
      const id = req.params.id;
      const updatedBook = req.body;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: updatedBook };

      const result = await booksCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

  } catch (error) {
    console.log(error);
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Bookcourier Server!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
