const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.Stripe_Key);

const app = express();
const port = process.env.PORT || 4040;

app.use(cors());
app.use(express.json());

// MongoDB
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
    const db = client.db("bookCourier");

    const booksCollection = db.collection("books");
    const ordersCollection = db.collection("orders");
    const roleCollection = db.collection("userRoles");
    const usersCollection = db.collection("users");
    const wishlistCollection = db.collection("wishlists");
    const reviewsCollection = db.collection("reviews");

    console.log("MongoDB Connected");

    // ================= STRIPE =================
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = Math.round(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // ================= USER ROLE (FIXED) =================
    app.post("/user-role", async (req, res) => {
      try {
        const { email, role } = req.body;

        const finalRole =
          email === process.env.ADMIN_EMAIL
            ? "admin"
            : role?.toLowerCase() === "librarian"
            ? "librarian"
            : "user";

        await roleCollection.updateOne(
          { email },
          { $set: { email, role: finalRole } },
          { upsert: true }
        );

        await usersCollection.updateOne(
          { email },
          { $set: { email, role: finalRole } },
          { upsert: true }
        );

        res.send({ email, role: finalRole });
      } catch (err) {
        res.status(500).send({ error: "Failed to set role" });
      }
    });

    app.get("/user-role/:email", async (req, res) => {
      const email = req.params.email;
      const result = await roleCollection.findOne({ email });
      res.send(result || { role: "user" });
    });

    // ================= USERS =================
    app.get("/users", async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    app.put("/users/role/:email", async (req, res) => {
      const email = req.params.email;
      const { role } = req.body;
      const result = await usersCollection.updateOne(
        { email },
        { $set: { role } },
        { upsert: true }
      );
      res.send(result);
    });

    // ================= BOOKS =================
    app.get("/books", async (req, res) => {
      const status = req.query.status;
      const query = status ? { status } : {};
      res.send(await booksCollection.find(query).toArray());
    });

    app.get("/books/latest", async (req, res) => {
      res.send(
        await booksCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray()
      );
    });

    app.get("/books/:id", async (req, res) => {
      res.send(
        await booksCollection.findOne({ _id: new ObjectId(req.params.id) })
      );
    });

    app.post("/books", async (req, res) => {
      const book = req.body;
      book.status = "unpublished";
      book.createdAt = new Date();
      res.send(await booksCollection.insertOne(book));
    });

    app.patch("/books/:id/publish", async (req, res) => {
      res.send(
        await booksCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { status: req.body.publish } }
        )
      );
    });

    // ================= ORDERS =================
    app.post("/orders", async (req, res) => {
      const order = req.body;
      order.status = "pending";
      order.paymentStatus = "unpaid";
      order.orderDate = new Date();
      order.bookId = order.bookId.toString();
      res.send(await ordersCollection.insertOne(order));
    });

    app.get("/orders/user/:email", async (req, res) => {
      res.send(
        await ordersCollection
          .find({ buyerEmail: req.params.email })
          .toArray()
      );
    });

    app.patch("/orders/:id", async (req, res) => {
      res.send(
        await ordersCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          {
            $set: {
              paymentStatus: "paid",
              transactionId: req.body.transactionId,
              paidAt: new Date(),
            },
          }
        )
      );
    });

    // ================= WISHLIST =================
    app.post("/wishlist", async (req, res) => {
      const exists = await wishlistCollection.findOne(req.body);
      if (exists) return res.status(400).send({ message: "Already added" });
      res.send(await wishlistCollection.insertOne(req.body));
    });

    app.get("/wishlist", async (req, res) => {
      res.send(
        await wishlistCollection
          .find({ userEmail: req.query.email })
          .toArray()
      );
    });

    // ================= REVIEWS =================
    app.get("/can-review", async (req, res) => {
      const order = await ordersCollection.findOne({
        bookId: req.query.bookId,
        buyerEmail: req.query.email,
      });
      res.send({ canReview: !!order });
    });

    app.post("/reviews", async (req, res) => {
      const exists = await reviewsCollection.findOne({
        bookId: req.body.bookId,
        userEmail: req.body.userEmail,
      });
      if (exists) return res.status(400).send({ message: "Already reviewed" });

      req.body.createdAt = new Date();
      res.send(await reviewsCollection.insertOne(req.body));
    });

    app.get("/reviews/:bookId", async (req, res) => {
      res.send(
        await reviewsCollection
          .find({ bookId: req.params.bookId })
          .sort({ createdAt: -1 })
          .toArray()
      );
    });

    console.log("All routes ready");
  } catch (err) {
    console.error(err);
  }
}

run();

app.get("/", (req, res) => res.send("BookCourier Server Running"));
app.listen(port, () => console.log(`Server running on ${port}`));
