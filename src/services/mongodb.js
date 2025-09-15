const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const config = require('../config/config');

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(config.mongodbConnectionString, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let connectionOpened;
let timeoutId;

async function connectClient() {
    clearTimeout(timeoutId);
    if(!connectionOpened){
        await client.connect();
        connectionOpened = true;
        console.log("Connection opened", connectionOpened);
    }    
    timeoutId = setTimeout(() => {
        client.close();
        console.log("Connection closed");
        connectionOpened = false;
    }, 1000 * 60 * 60);
}

function mapDocumentFromMongo(doc) {
    const { _id, ...rest } = doc;
    return {
        ...rest,
        id: _id.toString(),
    }
}

const createDocument = async (collectionName, doc) => {
    let result;
    try {
        await connectClient();
        const collection = client.db('i-will-pay').collection(collectionName);
        const res = await collection.insertOne(doc);
        const newDocument = await collection.findOne({ _id: res.insertedId });
        return newDocument ? mapDocumentFromMongo(newDocument) : null;
    } catch (err) {
        console.log('Operation createDocument failed', err);
        result = false;
    }
    return result;
}

const createDocuments = async (collectionName, docs) => {
    let result;
    try {
        await connectClient();
        
        const collection = getClient().db('i-will-pay').collection(collectionName);
        const res = await collection.insertMany(docs);
        // ToDo Получить айдишки созданных записей
        const insertedIds = [];
        
        const newDocuments = await collection.find({ _id: { $in: insertedIds } }).toArray();
        result = newDocuments.map(mapDocumentFromMongo);
    } catch (err) {
        console.log('Operation createDocuments failed', err);
        result = false;
    }
    return result;
}

const getDocuments = async (collectionName, query) => {
    let result;
    try {
        await connectClient();
        
        const collection = client.db('i-will-pay').collection(collectionName);

        const res = await collection.find(query).toArray();
        result = res.map(mapDocumentFromMongo);
    } catch (err) {
        console.log('Operation getDocuments failed', err);
        result = false;
    }
    return result;
}

const getDocument = async (collectionName, id) => {
    let result;
    try {
        await connectClient();
        
        const collection = client.db('i-will-pay').collection(collectionName);
        const doc = await collection.findOne({ _id: new ObjectId(id) });
        result = doc ? mapDocumentFromMongo(doc) : null;
    } catch (err) {
        console.log('Operation getDocument failed', err);
        result = false;
    }
    return result;
}

const getDocumentByQuery = async (collectionName, query) => {
    let result;
    try {
        await connectClient();
        
        const collection = client.db('i-will-pay').collection(collectionName);
        const doc = await collection.findOne(query);
        result = doc ? mapDocumentFromMongo(doc) : null;
    } catch (err) {
        console.log('Operation getDocumentByQuery failed', err);
        result = false;
    }
    return result;
}

const updateDocument = async (collectionName, doc) => {
    let result;
    try {
        await connectClient();        
        const { id, ...rest } = doc;
        const collection = client.db('i-will-pay').collection(collectionName);
        await collection.updateOne({ _id: new ObjectId(id) }, { $set: rest });
        const updatedDocument = await collection.findOne({ _id: new ObjectId(id) });
        result = updatedDocument ? mapDocumentFromMongo(updatedDocument) : null;
    } catch (err) {
        console.log('Operation updateDocument failed', err);
        result = false;
    } 
    return result;
}

const updateDocumentByQuery = async (collectionName, query, update) => {
    let result;
    try {
        await connectClient();
        const collection = client.db('i-will-pay').collection(collectionName);
        await collection.updateOne(query, update);
        const updatedDocument = await collection.findOne(query);
        result = updatedDocument ? mapDocumentFromMongo(updatedDocument) : null;
    } catch (err) {
        console.log('Operation updateDocument failed', err);
        result = false;
    } 
    return result;
}

const updateDocuments = async (collectionName, query, update) => {
    let result;
    try {
        await connectClient();
        
        const collection = client.db('i-will-pay').collection(collectionName);
        await collection.updateMany(query, update);
        const updatedDocuments = await collection.find(query).toArray();
        result = updatedDocuments.map(mapDocumentFromMongo);
    } catch (err) {
        console.log('Operation updateDocuments failed', err);
        result = false;
    } 
    return result;
}

const updateDocumentsByQuery = async (collectionName, updates) => {
    let result;
    try {
        await connectClient();
        
        const collection = client.db('i-will-pay').collection(collectionName);
        
        const bulkOps = updates.map(({ id, updateQuery }) => ({
            updateOne: {
                filter: { _id: new ObjectId(id) },
                update: updateQuery,
            },
        }));

        await collection.bulkWrite(bulkOps);
        const updatedDocuments = await collection.find({_id: {$in: updates.map(id => new ObjectId(id))}}).toArray();
        result = updatedDocuments.map(mapDocumentFromMongo);
    } catch (err) {
        console.log('Operation updateDocuments failed', err);
        result = false;
    } 
    return result;
}

const deleteDocument = async (collectionName, id) => {
    let result;
    try {
        await connectClient();
        
        const collection = client.db('i-will-pay').collection(collectionName);
        await collection.deleteOne({ _id: new ObjectId(id) });
        result = true;
    } catch (err) {
        console.log('Operation updateDocuments failed', err);
        result = null;
    } 
    return result;
}
const deleteDocumentByQuery = async (collectionName, query) => {
    let result;
    try {
        await connectClient();
        const collection = client.db('i-will-pay').collection(collectionName);
        await collection.deleteOne(query);
        result = true;
    } catch (err) {
        console.log('Operation updateDocuments failed', err);
        result = null;
    } 
    return result;
}

const deleteDocumentsByQuery = async (collectionName, query) => {
    let result;
    try {
        await connectClient();
        const collection = client.db('i-will-pay').collection(collectionName);
        await collection.deleteMany(query);
        result = true;
    } catch (err) {
        console.log('Operation updateDocuments failed', err);
        result = null;
    } 
    return result;
}

const aggregate = async (collectionName, query) => {
    let result;
    try {
        await connectClient();
        const collection = client.db('i-will-pay').collection(collectionName);
        aggregationResults = await collection.aggregate(query).toArray();
        result = aggregationResults.map(mapDocumentFromMongo);
    } catch (err) {
        console.log('Operation aggregate failed', err);
        result = null;
    } 
    return result;
}

module.exports = {
    getDocument: getDocument,
    getDocumentByQuery: getDocumentByQuery,
    getDocuments: getDocuments,
    createDocument: createDocument,
    updateDocument: updateDocument,
    updateDocuments: updateDocuments,
    deleteDocument: deleteDocument,
    deleteDocumentByQuery: deleteDocumentByQuery,
    deleteDocumentsByQuery: deleteDocumentsByQuery,
    createDocuments: createDocuments,
    updateDocumentByQuery: updateDocumentByQuery,
    updateDocumentsByQuery: updateDocumentsByQuery,
    aggregate: aggregate,
};

process.on('exit', () => {
    client.close();
})