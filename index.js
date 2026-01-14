const express = require("express");
const cors = require("cors");
require("dotenv").config();

// initial app
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// simple get route
app.get("/", (req, res) => {
  res.send("ShifiGo server is running");
});

const { MongoClient, ServerApiVersion } = require("mongodb");
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

    const parcelCollection = client.db("shiftiGo").collection("parcels");

    // insert parcel
    app.post("/parcels", async (req, res) => {
      try {
        const newParcel = req.body;
        const result = await parcelCollection.insertOne(newParcel);
        res.status(201).send(result);
      } catch (error) {
        console.error("Failed to insert", error);
        res.status(500).send({ message: "Failed to insert parcel" });
      }
    });

    // get all parcel
    app.get("/parcels", async (req, res) => {
      try {
        const result = await parcelCollection.find().toArray();
        res.status(200).send(result);
      } catch (error) {
        console.error("Failed to get", error);
        res.status(500).send({ message: "Failed to get parcels" });
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
