const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
    serviceName: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    price: {
        type: Number,
        min: 0,
        default: null
    },
    orderTax: {
        type: Number,
        min: 0,
        default: 0
    },
    taxType: {
        type: String,
        enum: ['fixed', 'percentage'],
        default: 'fixed'
    },
    // New field for service charge (keeping orderTax for backward compatibility)
    serviceCharge: {
        type: Number,
        min: 0,
        default: 0
    },
    serviceChargeType: {
        type: String,
        enum: ['fixed', 'percentage'],
        default: 'fixed'
    },
    discount: {
        type: Number,
        min: 0,
        default: 0
    },
    discountType: {
        type: String,
        enum: ['fixed', 'percentage'],
        default: 'fixed'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Custom validation for orderTax based on taxType
serviceSchema.pre('save', function(next) {
    // Validate tax based on type
    if (this.taxType === 'percentage' && this.orderTax > 100) {
        return next(new Error('Tax percentage cannot exceed 100%'));
    }
    
    // Validate service charge based on type
    if (this.serviceChargeType === 'percentage' && this.serviceCharge > 100) {
        return next(new Error('Service charge percentage cannot exceed 100%'));
    }
    
    // Validate discount based on type
    if (this.discountType === 'percentage' && this.discount > 100) {
        return next(new Error('Discount percentage cannot exceed 100%'));
    }
    
    // Update the updatedAt field
    this.updatedAt = Date.now();
    next();
});

// Custom validation for orderTax during updates
serviceSchema.pre('findOneAndUpdate', function(next) {
    const update = this.getUpdate();
    
    // Check if we're updating tax-related fields
    if (update.taxType === 'percentage' && update.orderTax > 100) {
        return next(new Error('Tax percentage cannot exceed 100%'));
    }
    
    // Check if we're updating service charge-related fields
    if (update.serviceChargeType === 'percentage' && update.serviceCharge > 100) {
        return next(new Error('Service charge percentage cannot exceed 100%'));
    }
    
    // Check if we're updating discount-related fields
    if (update.discountType === 'percentage' && update.discount > 100) {
        return next(new Error('Discount percentage cannot exceed 100%'));
    }
    
    // Set updatedAt
    update.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Service', serviceSchema);