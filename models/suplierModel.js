const mongoose = require('mongoose');
const newSuplier = new mongoose.Schema({
    username:{
        type:String,
        sparse: true
    },
    name:{
        type:String,
        required:true
    },
    companyName:{
        type:String,
        required:true
    },
    nic:{
        type:String,
    },
    mobile:{
        type:String,
        required:true,
        unique:true
    },
    country:{
        type:String,
    },
    city:{
        type:String,
    },
    address:{
        type:String,
    },
    createdAt: {
        type: Date,
        default: Date.now 
    }
})
const Suplier = mongoose.model('suplier',newSuplier);
module.exports =Suplier;