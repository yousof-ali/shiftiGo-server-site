const express = require("express");
const cors = require("cors");
require("dotenv").config();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

// initial app
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials:true
  }),
  
);
app.use(express.json());
app.use(cookieParser());

// simple get route
app.get("/", (req, res) => {
  res.send("ShifiGo server is running");
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lewcb.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("shiftiGo").collection("users");
    const parcelCollection = client.db("shiftiGo").collection("parcels");
    const paymentCollections = client.db("shiftiGo").collection("payment");

    //jwt token
    app.post("/jwt-token", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        secure: process.env.NODE_ENV === "production" ? true : false,
      })
      .send({ success: true });
    });

    // user
    app.post("/user", async (req, res) => {
      try {
        const email = req.body.email;
        const isExist = await userCollection.findOne({ email });

        if (isExist) {
          const updateResult = await userCollection.updateOne(
            { email },
            { $set: { lastLogIn: req.body.lastLogIn } },
          );

          return res.status(200).send({ message: "User login successfully" });
        }

        const user = req.body;
        const result = await userCollection.insertOne(user);
        res.status(201).send(result);
      } catch (err) {
        console.error("Failed to insert user", err);
        res.status(500).send({ message: "Failed to insert user" });
      }
    });

    // insert parcel
    app.post("/parcels", async (req, res) => {
      try {
        const newParcel = req.body;
        const result = await parcelCollection.insertOne(newParcel);
        res.status(201).send(result);
      } catch (error) {
        console.error("Failed to Insert", error);
        res.status(500).send({ message: "Failed to insert parcel" });
      }
    });

    // get all parcel
    app.get("/parcels", async (req, res) => {
      try {
        const queryEmail = req.query.email;
        const query = queryEmail ? { createdBy: queryEmail } : {};
        const option = {
          sort: { createdAt: -1 },
        };
        const result = await parcelCollection.find(query, option).toArray();
        res.status(200).send(result);
      } catch (error) {
        console.error("Failed to Get", error);
        res.status(500).send({ message: "Failed to get parcels" });
      }
    });

    // get single parcel
    app.get("/parcel/:id", async (req, res) => {
      const parcelID = req.params.id;
      try {
        const query = { _id: new ObjectId(parcelID) };
        const result = await parcelCollection.findOne(query);
        res.status(200).send(result);
      } catch (err) {
        console.error("Faild to get parcel", err);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // delete single parcelDF
    app.delete("/parcel/:id", async (req, res) => {
      const deletedID = req.params.id;
      try {
        const query = { _id: new ObjectId(deletedID) };
        const result = await parcelCollection.deleteOne(query);

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Parcel not found" });
        }
        res.status(200).send(result);
      } catch (error) {
        console.error("Failed to Detelte", error);
        res.status(500).send({ message: "Internal server error " });
      }
    });

    // payment client entent
    app.post("/create-payment-intent", async (req, res) => {
      try {
        const amount = req.body.amount;
        console.log(amount);

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount * 100, // convert dollars to cents
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: err.message });
      }
    });

    // store trangaction data
    app.post("/payments", async (req, res) => {
      try {
        const { parcelID, email, amount, transactionId } = req.body;
        if (!parcelID || !email || !amount || !transactionId) {
          return res.status(400).send({ message: "Missing payment data" });
        }
        const result = await parcelCollection.updateOne(
          { _id: new ObjectId(parcelID) },
          { $set: { paymentStatus: "paid" } },
        );

        if (result.modifiedCount === 0) {
          return res.status(404).send({ message: "parcel not found" });
        }

        const paymentDoc = {
          parcelID,
          email,
          amount,
          paymentMethod: "card",
          transactionId,
          currency: "usd",
          paid_at: new Date(),
          paidAt: new Date().toISOString(),
          status: "paid",
        };
        const result2 = await paymentCollections.insertOne(paymentDoc);
        res.status(201).send(result2);
      } catch (err) {
        console.error();
        res.status(500).send({ message: err.message });
      }
    });

    // get transaction history
    app.get("/transaction", async (req, res) => {
      try {
        const queryEmail = req.query.email;
        const query = queryEmail ? { email: queryEmail } : {};
        const option = {
          sort: { createdAt: -1 },
        };
        const result = await paymentCollections.find(query, option).toArray();
        res.status(200).send(result);
      } catch (error) {
        console.error("Failed to Get", error);
        res.status(500).send({ message: "Failed to get transaction history" });
      }
    });

    console.log("Connect with mongoDB successfully!");

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// listen the server
app.listen(port, () => {
  console.log(`ShifiGo server is running on port ${port}`);
});
