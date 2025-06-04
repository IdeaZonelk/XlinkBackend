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

const settingsSchema = new mongoose.Schema({
    email: { type: String, required: true },
    currency: { type: String, required: true },
    companyName: { type: String, required: true },
    companyMobile: { type: String, required: true },
    developerBy: { type: String },
    footer: { type: String },
    country: { type: String },
    city: { type: String },
    dateFormat: { type: String },
    postalCode: { type: String },
    address: { type: String },
    defaultWarehouse: { type: String },
    logo: String,
});

module.exports = mongoose.model('Settings', settingsSchema);
