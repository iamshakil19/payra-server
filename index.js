const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

// middleware
app.use(cors());
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bqjy6zm.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const bloodDonorRequestCollection = client.db('payra').collection('donor-request')
        const bloodDonorCollection = client.db('payra').collection('donor-list')


        /* 
            all get api
        */
        app.get('/donor-list', async (req, res) => {
            const donor = await bloodDonorCollection.find().toArray()
            res.send(donor)
        })

        /* 
            all post api
        */
        app.post('/donor-request', async (req, res) => {
            const newDonorRequest = req.body;
            const result = await bloodDonorRequestCollection.insertOne(newDonorRequest);
            res.send(result);
        })

    }
    finally {

    }
}
run().catch(console.dir)


app.get('/', (req, res) => {
    res.send('running payra server')
})
app.listen(port, () => {
    console.log("payra app listening to port", port);
})