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
        const divisionCollection = client.db('payra').collection('divisions')
        const districtCollection = client.db('payra').collection('districts')
        const upazilaCollection = client.db('payra').collection('upazilas')
        const uninCollection = client.db('payra').collection('unions')
        const villageCollection = client.db('payra').collection('villages')


        /* =======================
            ALL Division API
            ======================== */
        app.get('/divisions', async (req, res) => {
            const divisions = await divisionCollection.find().toArray()
            res.send({ divisions: divisions })
        })

        /* =======================
            ALL District API
            ======================== */
        app.get('/districts', async (req, res) => {
            const districts = await districtCollection.find().toArray()
            res.send({ districts: districts })
        })

        /* =======================
            ALL Upazila API
            ======================== */
        app.get('/upazilas', async (req, res) => {
            const upazilas = await upazilaCollection.find().toArray()
            res.send({ upazilas: upazilas })
        })
        app.post('/upazilas', async (req, res) => {
            const upazilasInfo = req.body;
            const result = await upazilaCollection.insertOne(upazilasInfo);
            res.send(result);
        })

        /* =======================
            ALL Union API
            ======================== */
        app.get('/unions', async (req, res) => {
            const unions = await uninCollection.find().toArray()
            res.send({ unions: unions })
        })
        app.post('/unions', async (req, res) => {
            const unionsInfo = req.body;
            const result = await uninCollection.insertOne(unionsInfo);
            res.send(result);
        })


        /* =======================
            ALL Village API
            ======================== */
            app.get('/villages', async (req, res) => {
                const villages = await villageCollection.find().toArray()
                res.send({ villages: villages })
            })
            app.post('/villages', async (req, res) => {
                const villagesInfo = req.body;
                const result = await villageCollection.insertOne(villagesInfo);
                res.send(result);
            })

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
            const filter = { role: { $in: ["admin", "superAdmin"] } }
            const mySort = { adminCreationTime: -1 }
            const allAdmin = await userCollection.find(filter).sort(mySort).toArray()
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
            const limit = Number(req.query.limit);
            const skip = Number(req.query.pageNumber);
            const userSearchData = req.query.userSearchData;
            const mySort = { email: 1 }
            const users = await userCollection.find({ $or: [{ email: { $regex: userSearchData, $options: 'i' } }, { name: { $regex: userSearchData, $options: 'i' } }] }).skip(limit * skip).limit(limit).sort(mySort).toArray()
            const userLength = await userCollection.find({ $or: [{ email: { $regex: userSearchData, $options: 'i' } }, { name: { $regex: userSearchData, $options: 'i' } }] }).toArray();
            const count = userLength.length
            const pageCount = Math.ceil(count / limit);
            res.send({ users: users, totalCount: count, pageCount: pageCount })
        })

        app.delete('/deleteUser/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await userCollection.deleteOne(query)
            res.send(result)
        })

        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const adminCreationTime = new Date()
            const email = req.params.email;
            const requester = req?.decoded?.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'superAdmin') {
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin', adminCreationTime: adminCreationTime },
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

        app.get('/top-donor', verifyJWT, async (req, res) => {
            const sortDonor = { donationCount: -1 }
            const topDonor = await bloodDonorCollection.find().sort(sortDonor).toArray()
            res.send(topDonor)
        })

        app.get('/donor-request', verifyJWT, async (req, res) => {
            const limit = Number(req.query.limit);
            const skip = Number(req.query.pageNumber);
            const status = "pending"
            const query = { status: status }
            const pendingRequest = await bloodDonorCollection.find(query).skip(limit * skip).limit(limit).toArray()
            const pendingRequestLength = await bloodDonorCollection.find(query).toArray();
            const count = pendingRequestLength.length;
            const pageCount = Math.ceil(count / limit);
            res.send({ allDonorRequest: pendingRequest, totalCount: count, pageCount: pageCount })
        })

        app.get('/verified-donor', verifyJWT, async (req, res) => {
            const status = "verified"
            const mySort = { acceptedTime: -1 }
            const filter = { status: status }
            const verifiedDonor = await bloodDonorCollection.find(filter).sort(mySort).toArray()
            res.send(verifiedDonor)
        })
        app.get('/available-donor', verifyJWT, async (req, res) => {
            const query = req.query
            const limit = Number(query.limit);
            const skip = Number(query.pageNumber);
            const userSortBy = query.sortByDonateCount;
            const donorSearchData = query.donorSearchData;

            const divisionFilterData = query.divisionFilterData;
            const districtFilterData = query.districtFilterData;
            const upazilaFilterData = query.upazilaFilterData;
            const unionFilterData = query.unionFilterData;
            const villageFilterData = query.villageFilterData;
            const bloodGroupFilterData = query.bloodGroupFilterData;

            const mySort = { [userSortBy]: -1 };
            const status = "verified";
            const filter = { status: status, available: true, $or: [{ name: { $regex: donorSearchData, $options: 'i' } }, { age: { $regex: donorSearchData, $options: 'i' } }, { district: { $regex: donorSearchData, $options: 'i' } }, { upazila: { $regex: donorSearchData, $options: 'i' } }, { union: { $regex: donorSearchData, $options: 'i' } }, { village: { $regex: donorSearchData, $options: 'i' } }, { gender: { $regex: donorSearchData, $options: 'i' } }] };
            if (divisionFilterData) {
                filter.division = divisionFilterData
            }
            if (districtFilterData) {
                filter.district = districtFilterData
            }
            if (upazilaFilterData) {
                filter.upazila = upazilaFilterData
            }
            if (unionFilterData) {
                filter.union = unionFilterData
            }
            if (villageFilterData) {
                filter.village = villageFilterData
            }
            if (bloodGroupFilterData) {
                filter.bloodGroup = bloodGroupFilterData
            }
            const verifiedDonor = await bloodDonorCollection.find(filter).skip(limit * skip).limit(limit).sort(mySort).toArray();
            const availableBloodLength = await bloodDonorCollection.find(filter).toArray();
            const count = availableBloodLength.length;
            const pageCount = Math.ceil(count / limit);
            res.send({ availableDonorList: verifiedDonor, totalCount: count, pageCount: pageCount });
        })
        app.get('/unavailable-donor', verifyJWT, async (req, res) => {
            const query = req.query
            const limit = Number(query.limit);
            const skip = Number(query.pageNumber);
            const userSortBy = query.sortByDonateCount;
            let sortName = userSortBy.split(",")[0]
            let orderBy = userSortBy.split(",")[1]
            const donorSearchData = query.donorSearchData;

            const divisionFilterData = query.divisionFilterData;
            const districtFilterData = query.districtFilterData;
            const upazilaFilterData = query.upazilaFilterData;
            const unionFilterData = query.unionFilterData;
            const villageFilterData = query.villageFilterData;
            const bloodGroupFilterData = query.bloodGroupFilterData;

            const mySort = { [sortName]: orderBy };
            const status = "verified";

            const filter = { status: status, available: false, $or: [{ name: { $regex: donorSearchData, $options: 'i' } }, { age: { $regex: donorSearchData, $options: 'i' } }, { district: { $regex: donorSearchData, $options: 'i' } }, { upazila: { $regex: donorSearchData, $options: 'i' } }, { union: { $regex: donorSearchData, $options: 'i' } }, { village: { $regex: donorSearchData, $options: 'i' } }, { gender: { $regex: donorSearchData, $options: 'i' } }] };
            if (divisionFilterData) {
                filter.division = divisionFilterData
            }
            if (districtFilterData) {
                filter.district = districtFilterData
            }
            if (upazilaFilterData) {
                filter.upazila = upazilaFilterData
            }
            if (unionFilterData) {
                filter.union = unionFilterData
            }
            if (villageFilterData) {
                filter.village = villageFilterData
            }
            if (bloodGroupFilterData) {
                filter.bloodGroup = bloodGroupFilterData
            }
            const verifiedDonor = await bloodDonorCollection.find(filter).skip(limit * skip).limit(limit).sort(mySort).toArray();
            const unavailableBloodLength = await bloodDonorCollection.find(filter).toArray();
            const count = unavailableBloodLength.length;
            const pageCount = Math.ceil(count / limit);
            res.send({ unavailableDonorList: verifiedDonor, totalCount: count, pageCount: pageCount });

            // const mySort = { donateButtonClickTime: 1 }
            // const status = "verified"
            // const filter = { status: status, available: false, $or: [{ name: { $regex: donorSearchData, $options: 'i' } }, { age: { $regex: donorSearchData, $options: 'i' } }, { union: { $regex: donorSearchData, $options: 'i' } }, { village: { $regex: donorSearchData, $options: 'i' } }, { gender: { $regex: donorSearchData, $options: 'i' } }] }

            // const verifiedDonor = await bloodDonorCollection.find(filter).skip(limit * skip).limit(limit).sort(mySort).toArray()
            // const unavailableBloodLength = await bloodDonorCollection.find(filter).toArray();
            // const count = unavailableBloodLength.length;
            // const pageCount = Math.ceil(count / limit)
            // res.send({ unavailableDonorList: verifiedDonor, totalCount: count, pageCount: pageCount })
        })

        app.post('/donor-request', async (req, res) => {
            const donorRequest = req.body;
            const result = await bloodDonorCollection.insertOne(donorRequest)
            res.send(result);
        })

        app.patch('/donorStatus/:id', async (req, res) => {
            const id = req.params.id;
            const donorInfo = req.body
            const filter = { _id: ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: donorInfo.status,
                    acceptedTime: donorInfo.acceptedTime,
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
            const filter = { _id: ObjectId(id) }

            const updateDoc = {
                $set: {
                    available: false,
                    time: donationTime.donateTime,
                    donateButtonClickTime: donationTime.donateButtonClickTime
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
            const limit = Number(req.query.limit);
            const skip = Number(req.query.pageNumber);
            const status = "incomplete";
            const filter = { status: status };
            const incompleteRequest = await bloodRequestCollection.find(filter).skip(limit * skip).limit(limit).toArray();
            const incompleteBloodLength = await bloodRequestCollection.find(filter).toArray();
            const count = incompleteBloodLength.length;

            const pageCount = Math.ceil(count / limit);

            res.send({ incompleteBloodRequestList: incompleteRequest, totalCount: count, pageCount: pageCount })
        })
        app.get('/complete-blood-request', verifyJWT, async (req, res) => {
            const limit = Number(req.query.limit)
            const skip = Number(req.query.pageNumber)
            const status = "done"
            const filter = { status: status }
            const sortByTime = { submissionTime: -1 }
            const completeRequest = await bloodRequestCollection.find(filter).skip(limit * skip).limit(limit).sort(sortByTime).toArray()
            const completeBloodLength = await bloodRequestCollection.find(filter).toArray()
            const count = completeBloodLength.length
            const pageCount = Math.ceil(count / limit)
            res.send({ completeBloodRequestList: completeRequest, totalCount: count, pageCount: pageCount })
        })

        app.post('/blood-request', async (req, res) => {
            const bloodRequest = req.body;
            const result = await bloodRequestCollection.insertOne(bloodRequest);
            res.send(result);
        })

        app.patch('/blood-request-status/:id', async (req, res) => {
            const id = req.params.id;
            const bloodRequestInfo = req.body
            console.log(bloodRequestInfo);
            const filter = { _id: ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: bloodRequestInfo.status,
                    submissionTime: bloodRequestInfo.submissionTime
                }
            }
            const updatedBloodRequestInfo = await bloodRequestCollection.updateOne(filter, updateDoc)
            res.send(updateDoc)
        })

        app.delete('/deleteBloodRequest/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const result = await bloodRequestCollection.deleteOne(filter)
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