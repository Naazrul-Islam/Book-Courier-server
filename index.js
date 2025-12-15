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
    const wishlistCollection = db.collection("wishlists");

    console.log("Connected to MongoDB!");

    // ================= STRIPE PAYMENT INTEGRATION =================
    app.post("/create-payment-intent", async (req, res) => {
      try {
        const { price } = req.body;
        if (!price) return res.status(400).send({ error: "Price is required" });
        const amount = Math.round(price * 100);
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        console.error("Stripe Error:", error);
        res.status(500).send({ error: error.message });
      }
    });

    // ================= ORDERS =================
    // Update payment
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

    app.get("/orders/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const order = await ordersCollection.findOne({ _id: new ObjectId(id) });
        res.send(order);
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch order" });
      }
    });

    
    // GET all books added by a specific librarian
app.get("/books/librarian/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const books = await booksCollection.find({ addedBy: email }).toArray();
    res.send(books);
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Failed to fetch librarian books" });
  }
});


    // Update order status
   app.patch("/books/:id", async (req, res) => {
  try {
    const { status, email } = req.body;
    const id = req.params.id;

    
    const book = await booksCollection.findOne({ _id: new ObjectId(id), addedBy: email });
    if (!book) return res.status(403).send({ error: "Not allowed to update this book" });

    const result = await booksCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } }
    );

    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Failed to update book status" });
  }
});
app.delete("/books/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { email } = req.query;

    
    const book = await booksCollection.findOne({ _id: new ObjectId(id), addedBy: email });
    if (!book) return res.status(403).send({ error: "Not allowed to delete this book" });

    await booksCollection.deleteOne({ _id: new ObjectId(id) });
    await ordersCollection.deleteMany({ bookId: id });

    res.send({ message: "Book and related orders deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Failed to delete book" });


  }
});


// ================= LIBRARIAN ORDERS =================
app.get("/orders/librarian/:email", async (req, res) => {
  try {
    const email = req.params.email;

    
    const books = await booksCollection.find({ addedBy: email }).toArray();
    const bookIds = books.map(b => b._id.toString());

  
    const orders = await ordersCollection.find({
      bookId: { $in: bookIds }
    }).toArray();

    res.send(orders);
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Failed to fetch librarian orders" });
  }
});

// ================= UPDATE ORDER STATUS =================
app.patch("/orders/status/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;

    const order = await ordersCollection.findOne({ _id: new ObjectId(id) });
    if (!order) return res.status(404).send({ error: "Order not found" });

    const allowed = {
      pending: ["shipped", "cancelled"],
      shipped: ["delivered"],
      delivered: [],
      cancelled: []
    };

    if (!allowed[order.status].includes(status)) {
      return res.status(400).send({ error: "Invalid status transition" });
    }

    const result = await ordersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } }
    );

    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Failed to update order status" });
  }
});



    // ================= BOOK ROUTES =================
    app.get("/books", async (req, res) => {
      try {
        const status = req.query.status;
        const query = status ? { status } : {};
        const result = await booksCollection.find(query).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch books" });
      }
    });

    app.get("/books/latest", async (req, res) => {
      try {
        const books = await booksCollection.find().sort({ createdAt: -1 }).limit(6).toArray();
        res.send(books);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    app.get("/books/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await booksCollection.findOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch book" });
      }
    });

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

    app.patch("/books/:id/publish", async (req, res) => {
      try {
        const id = req.params.id;
        const { publish } = req.body;
        const result = await booksCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: publish } }
        );
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: "Failed to update status" });
      }
    });

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

    // ================= ORDERS ROUTES =================
    app.post("/orders", async (req, res) => {
      try {
        const order = req.body;
        if (!order.buyerEmail) return res.status(400).send({ message: "buyerEmail is required" });

        order.status = "pending";
        order.paymentStatus = "unpaid";
        order.orderDate = new Date();

        // ensure bookId is string
        order.bookId = order.bookId.toString();

        const result = await ordersCollection.insertOne(order);
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: "Failed to place order" });
      }
    });

    app.get("/orders", async (req, res) => {
      try {
        const orders = await ordersCollection.find().toArray();
        res.send(orders);
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch orders" });
      }
    });

    app.get("/orders/user/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const orders = await ordersCollection.find({ buyerEmail: email }).toArray();
        res.send(orders);
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch user orders" });
      }
    });

    app.delete("/orders/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await ordersCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: "Failed to delete order" });
      }
    });

    // ================= PAYMENTS ROUTE =================
app.get("/payments/:email", async (req, res) => {
  try {
    const email = req.params.email.toLowerCase(); 
    const payments = await ordersCollection
      .find({ buyerEmail: email }) 
      .sort({ orderDate: -1 })
      .toArray();
    res.send(payments);
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Failed to fetch payments" });
  }
});


    // ================= WISHLIST ROUTES =================
    app.post("/wishlist", async (req, res) => {
      const wishlist = req.body;
      const query = { bookId: wishlist.bookId, userEmail: wishlist.userEmail };
      const exists = await wishlistCollection.findOne(query);
      if (exists) return res.status(400).send({ message: "Already added" });

      const result = await wishlistCollection.insertOne(wishlist);
      res.send(result);
    });

    app.get("/wishlist", async (req, res) => {
      const email = req.query.email;
      const result = await wishlistCollection.find({ userEmail: email }).toArray();
      res.send(result);
    });

    app.delete("/wishlist/:id", async (req, res) => {
      const id = req.params.id;
      const result = await wishlistCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // ================= USER ROLE ROUTES =================
    app.post("/user-role", async (req, res) => {
      try {
        const roleData = req.body;
        const result = await roleCollection.insertOne(roleData);
        const existingUser = await usersCollection.findOne({ email: roleData.email });
        if (!existingUser) {
          await usersCollection.insertOne({ email: roleData.email, role: roleData.role });
        }
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: "Failed to add user role" });
      }
    });

    app.get("/user-roles", async (req, res) => {
      try {
        const result = await roleCollection.find().toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: "Failed to get user roles" });
      }
    });

    app.get("/user-role/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const result = await roleCollection.findOne({ email });
        res.send(result || {});
      } catch (err) {
        res.status(500).send({ error: "Failed to get user role" });
      }
    });

    // ================= USERS ROUTES =================
    app.get("/users", async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.send(users);
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch users" });
      }
    });

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

    // ================= ADMIN EMAIL SET ROUTE =================
    const ADMIN_EMAIL = "youremail@gmail.com";

    app.post("/set-admin", async (req, res) => {
      const { email } = req.body;

      if (email !== ADMIN_EMAIL) {
        return res.status(403).send({ message: "Not allowed" });
      }

      const result = await usersCollection.updateOne(
        { email },
        { $set: { role: "admin" } },
        { upsert: true }
      );

      res.send({ message: "Admin successfully created", result });
    });

    // ================= ADD TEST PAYMENT / MARK PAYMENT AS PAID =================
app.post("/test-payment", async (req, res) => {
  try {
    const { orderId, transactionId } = req.body;
    if (!orderId || !transactionId) {
      return res.status(400).send({ message: "orderId and transactionId required" });
    }

    const result = await ordersCollection.updateOne(
      { _id: new ObjectId(orderId) },
      {
        $set: {
          paymentStatus: "paid",
          transactionId,
          paidAt: new Date(),
        },
      }
    );

    res.send({ message: "Payment updated successfully", result });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Failed to update test payment" });
  }
});

// ================= INSERT TEST ORDER =================
app.post("/test-order", async (req, res) => {
  try {
    const { buyerEmail, bookId, bookTitle, price } = req.body;
    if (!buyerEmail || !bookId || !bookTitle || !price) {
      return res.status(400).send({ message: "All fields are required" });
    }

    const newOrder = {
      buyerEmail,
      bookId: bookId.toString(),
      bookTitle,
      price,
      status: "pending",
      paymentStatus: "paid", // directly mark paid for testing
      transactionId: `txn_${Date.now()}`,
      paidAt: new Date(),
      orderDate: new Date(),
    };

    const result = await ordersCollection.insertOne(newOrder);
    res.send({ message: "Test order created", order: newOrder });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Failed to create test order" });
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
