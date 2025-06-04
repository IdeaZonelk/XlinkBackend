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

const DenominationSchema = new mongoose.Schema({
  denomination: { type: Number, required: true },
  quantity: { type: Number, required: true },
  amount: { type: Number, required: true }
});

const ZReadingSchema = new mongoose.Schema({
  cardPaymentAmount: { type: Number, required: true },
  cashPaymentAmount: { type: Number, required: true },
  bankTransferPaymentAmount: { type: Number, required: true },
  totalDiscountAmount: { type: Number, required: true },
  inputs: [DenominationSchema],
  registerData: {
    type: Map, 
    of: mongoose.Schema.Types.Mixed, 
    default: {}
  },
  cashVariance: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ZReading', ZReadingSchema);