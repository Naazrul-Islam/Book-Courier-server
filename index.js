// server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.Stripe_Key);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.c0vwcej.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("bookCourier");

    const booksCollection = db.collection("books");
    const ordersCollection = db.collection("orders");
    const roleCollection = db.collection("userRoles");
    const usersCollection = db.collection("users");

    console.log("Connected to MongoDB!");

    // ===== STRIPE PAYMENT INTEGRATION =====

app.post("/create-payment-intent", async (req, res) => {
  try {
    const { price } = req.body;

    if (!price) {
      return res.status(400).send({ error: "Price is required" });
    }

    const amount = Math.round(price * 100); // USD cents

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      payment_method_types: ["card"],
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Stripe Error:", error);
    res.status(500).send({ error: error.message });
  }
});

// Update order payment status

app.patch("/orders/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { paymentStatus, transactionId } = req.body;

    const result = await ordersCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          paymentStatus: paymentStatus || "paid",
          transactionId: transactionId || null,
          paidAt: new Date(),
        },
      }
    );

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Failed to update payment" });
  }
});


// Get single order by id (FOR PAYMENT PAGE)
app.get("/orders/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const order = await ordersCollection.findOne({ _id: new ObjectId(id) });
    res.send(order);
  } catch (err) {
    res.status(500).send({ error: "Failed to fetch order" });
  }
});




    // ===== BOOK ROUTES =====

    // Get all books (optional status filter)
    app.get("/books", async (req, res) => {
      try {
        const status = req.query.status;
         // "published" / "unpublished"
        const query = status ? { status } : {};
        
        const result = await booksCollection.find(query).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch books" });
      }
    });


    // server.js or books route
app.get("/books/latest", async (req, res) => {
  try {
    const books = await booksCollection
      .find()
      .sort({ createdAt: -1 }) // newest first
      .limit(6)               // get last 6 books
      .toArray();
    res.send(books);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});


    // Get single book
    app.get("/books/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await booksCollection.findOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch book" });
      }
    });

    // Add new book
    app.post("/books", async (req, res) => {
      try {
        const newBook = req.body;
        newBook.status = "unpublished";
        newBook.createdAt = new Date();
        const result = await booksCollection.insertOne(newBook);
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: "Failed to add book" });
      }
    });

    // Update book
    

    // Publish / Unpublish
    app.patch("/books/:id/publish", async (req, res) => {
      try {
        const id = req.params.id;
        const { publish } = req.body; // "published" / "unpublished"
        const result = await booksCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: publish } }
        );
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: "Failed to update status" });
      }
    });

    // Delete book + related orders
    app.delete("/books/:id", async (req, res) => {
      try {
        const id = req.params.id;
        await booksCollection.deleteOne({ _id: new ObjectId(id) });
        await ordersCollection.deleteMany({ bookId: id });
        res.send({ message: "Book and related orders deleted" });
      } catch (err) {
        res.status(500).send({ error: "Failed to delete book" });
      }
    });


    // ===== ORDER ROUTES =====

// Create a new order
app.post("/orders", async (req, res) => {
  try {
    const order = req.body;

    // Set default order states
    order.status = "pending";
    order.paymentStatus = "unpaid";
    order.orderDate = new Date();

    const result = await ordersCollection.insertOne(order);
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Failed to place order" });
  }
});

// Get all orders (admin/librarian panel)
app.get("/orders", async (req, res) => {
  try {
    const orders = await ordersCollection.find().toArray();
    res.send(orders);
  } catch (err) {
    res.status(500).send({ error: "Failed to fetch orders" });
  }
});


// Get orders by user email (user dashboard)
app.get("/orders/user/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const orders = await ordersCollection.find({ buyerEmail: email }).toArray();
    res.send(orders);
  } catch (err) {
    res.status(500).send({ error: "Failed to fetch user orders" });
  }
});
    // Update order status
    app.patch("/orders/status/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body; // "pending", "approved", "canceled"

    const result = await ordersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } }
    );

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Failed to update order status" });
  }
});

// Delete order
app.delete("/orders/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const result = await ordersCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Failed to delete order" });
  }
});

// Get user's payment history
app.get("/payments/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const payments = await ordersCollection
      .find({ buyerEmail: email, paymentStatus: "paid" })
      .toArray();

    res.send(payments);
  } catch (err) {
    res.status(500).send({ error: "Failed to fetch payments" });
  }
});


    // ===== USER ROLE ROUTES =====

    // Add user role
    app.post("/user-role", async (req, res) => {
      try {
        const roleData = req.body;
        const result = await roleCollection.insertOne(roleData);

        // Add to users collection if not exists
        const existingUser = await usersCollection.findOne({ email: roleData.email });
        if (!existingUser) {
          await usersCollection.insertOne({ email: roleData.email, role: roleData.role });
        }

        res.send(result);
      } catch (err) {
        res.status(500).send({ error: "Failed to add user role" });
      }
    });

    // Get all user roles
    app.get("/user-roles", async (req, res) => {
      try {
        const result = await roleCollection.find().toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: "Failed to get user roles" });
      }
    });

    // Get single user role
    app.get("/user-role/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const result = await roleCollection.findOne({ email });
        res.send(result || {});
      } catch (err) {
        res.status(500).send({ error: "Failed to get user role" });
      }
    });

    // ===== USERS ROUTES =====

    // Get all users
    app.get("/users", async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.send(users);
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch users" });
      }
    });

    // Update user role
    app.put("/users/role/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const { role } = req.body;
        const result = await usersCollection.updateOne(
          { email },
          { $set: { role } },
          { upsert: true }
        );
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: "Failed to update role" });
      }
    });

    console.log("Routes are ready!");
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);

// Root endpoint
app.get("/", (req, res) => {
  res.send("BookCourier Server Running!");
});

app.listen(port, () => console.log(`Server running on port ${port}`));
