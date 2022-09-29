const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middleware
app.use(cors());
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bqjy6zm.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded
        next()
    })
}


async function run() {
    try {
        await client.connect();
        const bloodDonorCollection = client.db('payra').collection('donor-list')
        const bloodRequestCollection = client.db('payra').collection('blood-request-list')
        const userCollection = client.db('payra').collection('users')
        const adminContactCollection = client.db('payra').collection('admin-contact')


        /* =======================
            ALL Admin API
            ======================== */
        app.post('/admin-contact', async (req, res) => {
            const contactInfo = req.body;
            const result = await adminContactCollection.insertOne(contactInfo);
            res.send(result);
        })

        app.get('/contacts', async (req, res) => {
            const contacts = await adminContactCollection.find().toArray()
            res.send(contacts)
        })

        app.get('/all-admin', verifyJWT, async (req, res) => {
            const query = { role: { $in: ["admin", "superAdmin"] } }
            const allAdmin = (await userCollection.find(query).toArray()).reverse()
            res.send(allAdmin)
        })

        app.get('/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email })
            const isAdmin = ((user.role === "superAdmin" || user.role === "admin") ? true : false)
            console.log(isAdmin);
            const adminRole = user.role
            res.send({ admin: isAdmin, role: adminRole })
        })

        app.delete('/delete-contact/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const requester = req?.decoded?.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'superAdmin') {
                const query = { _id: ObjectId(id) }
                const result = await adminContactCollection.deleteOne(query)
                res.send(result)
            }
            else {
                res.status(403).send({ message: 'forbidden access' })
            }

        })

        app.patch('/contact/:id', async (req, res) => {
            const id = req.params.id;
            const contact = req.body
            const filter = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    name: contact.name,
                    number1: contact.number1,
                    number2: contact.number2
                }
            }
            const updatedContact = await adminContactCollection.updateOne(filter, updatedDoc)
            res.send({ updatedDoc, success: true });
        })

        app.patch('/admin/accessibility/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const newRole = req.body.role;
            const requester = req?.decoded?.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'superAdmin') {
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: newRole },
                };
                const result = await userCollection.updateOne(filter, updateDoc)
                res.send(result)
            }
            else {
                res.status(403).send({ message: 'forbidden access' })
            }
        })

        /* =======================
            ALL USER API
            ======================== */
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true }
            const updateDoc = {
                $set: user
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2d' })
            res.send({ result, token })
        })

        app.get('/users', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray()
            res.send(users)
        })

        app.delete('/deleteUser/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await userCollection.deleteOne(query)
            res.send(result)
        })

        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req?.decoded?.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'superAdmin') {
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc)
                res.send(result)
            }
            else {
                res.status(403).send({ message: 'forbidden access' })
            }
        })

        /* =======================
            ALL BLOOD DONOR API
            ======================== */
        app.get('/donor-request', verifyJWT, async (req, res) => {
            const status = "pending"
            const query = { status: status }
            const pendingRequest = (await bloodDonorCollection.find(query).toArray()).reverse()
            res.send(pendingRequest)
        })

        app.get('/verified-donor', verifyJWT, async (req, res) => {
            const status = "verified"
            const query = { status: status }
            const verifiedDonor = (await bloodDonorCollection.find(query).toArray()).reverse()
            res.send(verifiedDonor)
        })
        app.get('/available-donor', verifyJWT, async (req, res) => {
            const status = "verified"
            const query = { status: status, available: true }
            const verifiedDonor = (await bloodDonorCollection.find(query).toArray()).reverse()
            res.send(verifiedDonor)
        })
        app.get('/unavailable-donor', verifyJWT, async (req, res) => {
            const status = "verified"
            const query = { status: status, available: false }
            const verifiedDonor = (await bloodDonorCollection.find(query).toArray()).reverse()
            res.send(verifiedDonor)
        })

        app.post('/donor-request', async (req, res) => {
            const donorRequest = req.body;
            const result = await bloodDonorCollection.insertOne(donorRequest);
            res.send(result);
        })

        app.patch('/donorStatus/:id', async (req, res) => {
            const id = req.params.id;
            const donorInfo = req.body
            const filter = { _id: ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: donorInfo.status,
                    available: true,
                    donationCount: 0
                }
            }
            const updatedDonorInfo = await bloodDonorCollection.updateOne(filter, updateDoc)
            res.send(updateDoc)
        })

        app.patch('/donationCount/:id', async (req, res) => {
            const id = req.params.id;
            const donationTime = req.body
            console.log(donationTime);
            const filter = { _id: ObjectId(id) }

            const updateDoc = {
                $set: {
                    available: false,
                    time: donationTime.donateTime
                },
                $inc: {
                    donationCount: + 1
                }
            }
            const updatedDonorInfo = await bloodDonorCollection.updateOne(filter, updateDoc)
            res.send(updateDoc)
        })
        
        app.patch('/handleAvailability/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const updateDoc = {
                $set: {
                    available: true
                }
            }
            const updatedDonorInfo = await bloodDonorCollection.updateOne(filter, updateDoc)
            res.send(updateDoc)
        })

        // app.put('/donationDate/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const filter = { _id: ObjectId(id) }
        //     console.log(id, filter);

        //     const updateDoc = {
        //         $setOnInsert: { dateAdded: new Date() }
        //     }
        //     const result = await bloodDonorCollection.updateOne(filter, updateDoc)
        //     res.send(result)
        // })

        app.delete('/donorRequest/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await bloodDonorCollection.deleteOne(query)
            res.send(result)
        })

        /* =======================
            ALL BLOOD REQUEST API
            ======================== */
        app.get('/incomplete-blood-request', verifyJWT, async (req, res) => {
            const status = "incomplete"
            const query = { status: status }
            const incompleteRequest = await bloodRequestCollection.find(query).toArray()
            res.send(incompleteRequest)
        })
        app.get('/complete-blood-request', verifyJWT, async (req, res) => {
            const status = "done"
            const query = { status: status }
            const completeRequest = (await bloodRequestCollection.find(query).toArray()).reverse()
            res.send(completeRequest)
        })

        app.post('/blood-request', async (req, res) => {
            const bloodRequest = req.body;
            const result = await bloodRequestCollection.insertOne(bloodRequest);
            res.send(result);
        })

        app.patch('/blood-request-status/:id', async (req, res) => {
            const id = req.params.id;
            const bloodRequestInfo = req.body
            const filter = { _id: ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: bloodRequestInfo.status
                }
            }
            const updatedBloodRequestInfo = await bloodRequestCollection.updateOne(filter, updateDoc)
            res.send(updateDoc)
        })

        app.delete('/deleteBloodRequest/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await bloodRequestCollection.deleteOne(query)
            res.send(result)
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