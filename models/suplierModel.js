/*
 * Copyright (c) 2025 Ideazone (Pvt) Ltd
 * Proprietary and Confidential
 *
 * This source code is part of a proprietary Point-of-Sale (POS) system developed by Ideazone (Pvt) Ltd.
 * Use of this code is governed by a license agreement and an NDA.
 * Unauthorized use, modification, distribution, or reverse engineering is strictly prohibited.
 *
 * Contact info@ideazone.lk for more information.
 */

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