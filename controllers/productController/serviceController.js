const Service = require('../../models/products/productService');

// Create a new service
exports.createService = async (req, res) => {
    try {
        const { serviceName, description, price, orderTax, taxType, discount, discountType, serviceCharge, serviceChargeType } = req.body;

        // Check if service already exists
        const existingService = await Service.findOne({ serviceName });
        if (existingService) {
            return res.status(400).json({
                status: 'error',
                message: 'Service with this name already exists'
            });
        }

        // Use serviceCharge if provided, otherwise fallback to orderTax for backward compatibility
        const finalServiceCharge = serviceCharge !== undefined ? serviceCharge : orderTax;
        const finalServiceChargeType = serviceChargeType || taxType;

        // Validate service charge value based on type
        if (finalServiceCharge) {
            if (finalServiceChargeType === 'percentage' && (finalServiceCharge < 0 || finalServiceCharge > 100)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Service charge percentage must be between 0 and 100'
                });
            }
            if (finalServiceChargeType === 'fixed' && finalServiceCharge < 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Fixed service charge amount cannot be negative'
                });
            }
        }

        // Validate discount value based on type
        if (discount) {
            if (discountType === 'percentage' && (discount < 0 || discount > 100)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Discount percentage must be between 0 and 100'
                });
            }
            if (discountType === 'fixed' && discount < 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Fixed discount amount cannot be negative'
                });
            }
        }

        // Create new service
        const newService = new Service({
            serviceName,
            description,
            price: price ? parseFloat(price) : null,
            orderTax: orderTax ? parseFloat(orderTax) : 0, // Keep for backward compatibility
            taxType: taxType || 'fixed',
            serviceCharge: finalServiceCharge ? parseFloat(finalServiceCharge) : 0,
            serviceChargeType: finalServiceChargeType || 'fixed',
            discount: discount ? parseFloat(discount) : 0,
            discountType: discountType || 'fixed'
        });

        await newService.save();

        // Calculate final price for response
        let finalPrice = newService.price || 0;
        let serviceChargeAmount = 0;
        let discountAmount = 0;

        // Calculate service charge (use serviceCharge if available, otherwise orderTax for backward compatibility)
        const chargeValue = newService.serviceCharge || newService.orderTax || 0;
        const chargeType = newService.serviceChargeType || newService.taxType || 'fixed';
        
        if (chargeValue > 0) {
            if (chargeType === 'percentage') {
                serviceChargeAmount = (finalPrice * chargeValue) / 100;
            } else {
                serviceChargeAmount = chargeValue;
            }
        }

        // Calculate discount
        if (newService.discount > 0) {
            if (newService.discountType === 'percentage') {
                discountAmount = (finalPrice * newService.discount) / 100;
            } else {
                discountAmount = newService.discount;
            }
        }

        finalPrice = finalPrice + serviceChargeAmount - discountAmount;
        const calculatedFinalPrice = Math.max(0, finalPrice);

        res.status(201).json({
            status: 'success',
            message: 'Service created successfully',
            service: {
                ...newService.toObject(),
                finalPrice: calculatedFinalPrice,
                serviceChargeAmount,
                discountAmount
            }
        });
    } catch (error) {
        console.error('Error creating service:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
};

// Get all services with pagination
exports.findAllService = async (req, res) => {
    try {
        const page = parseInt(req.query['page[number]']) || 1;
        const size = parseInt(req.query['page[size]']) || 10;
        const skip = (page - 1) * size;

        const services = await Service.find({ isActive: true })
            .skip(skip)
            .limit(size)
            .sort({ createdAt: -1 });

        // Calculate final price for each service
        const servicesWithFinalPrice = services.map(service => {
            let finalPrice = service.price || 0;
            let serviceChargeAmount = 0;
            let discountAmount = 0;

            // Calculate service charge (use serviceCharge if available, otherwise orderTax for backward compatibility)
            const chargeValue = service.serviceCharge || service.orderTax || 0;
            const chargeType = service.serviceChargeType || service.taxType || 'fixed';
            
            if (chargeValue > 0) {
                if (chargeType === 'percentage') {
                    serviceChargeAmount = (finalPrice * chargeValue) / 100;
                } else {
                    serviceChargeAmount = chargeValue;
                }
            }

            // Calculate discount
            if (service.discount > 0) {
                if (service.discountType === 'percentage') {
                    discountAmount = (finalPrice * service.discount) / 100;
                } else {
                    discountAmount = service.discount;
                }
            }

            finalPrice = finalPrice + serviceChargeAmount - discountAmount;

            return {
                ...service.toObject(),
                finalPrice: Math.max(0, finalPrice), // Ensure final price is not negative
                serviceChargeAmount,
                discountAmount
            };
        });

        const totalServices = await Service.countDocuments({ isActive: true });
        const totalPages = Math.ceil(totalServices / size);

        res.status(200).json({
            status: 'success',
            services: servicesWithFinalPrice,
            totalPages,
            currentPage: page,
            totalServices
        });
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
};

// Get all services without pagination (for POS popup)
exports.findAllServiceNoPagination = async (req, res) => {
    try {
        const services = await Service.find({ isActive: true })
            .sort({ createdAt: -1 });

        // Calculate final price for each service
        const servicesWithFinalPrice = services.map(service => {
            let finalPrice = service.price || 0;
            let serviceChargeAmount = 0;
            let discountAmount = 0;

            // Calculate service charge (use serviceCharge if available, otherwise orderTax for backward compatibility)
            const chargeValue = service.serviceCharge || service.orderTax || 0;
            const chargeType = service.serviceChargeType || service.taxType || 'fixed';
            
            if (chargeValue > 0) {
                if (chargeType === 'percentage') {
                    serviceChargeAmount = (finalPrice * chargeValue) / 100;
                } else {
                    serviceChargeAmount = chargeValue;
                }
            }

            // Calculate discount
            if (service.discount > 0) {
                if (service.discountType === 'percentage') {
                    discountAmount = (finalPrice * service.discount) / 100;
                } else {
                    discountAmount = service.discount;
                }
            }

            finalPrice = finalPrice + serviceChargeAmount - discountAmount;

            return {
                ...service.toObject(),
                finalPrice: Math.max(0, finalPrice), // Ensure final price is not negative
                serviceChargeAmount,
                discountAmount
            };
        });

        res.status(200).json({
            status: 'success',
            services: servicesWithFinalPrice,
            totalServices: servicesWithFinalPrice.length
        });
    } catch (error) {
        console.error('Error fetching all services:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
};

// Search services by name
exports.searchService = async (req, res) => {
    try {
        const { keyword } = req.query;

        if (!keyword) {
            return res.status(400).json({
                status: 'error',
                message: 'Keyword is required for search'
            });
        }

        const services = await Service.find({
            serviceName: { $regex: keyword, $options: 'i' },
            isActive: true
        }).sort({ createdAt: -1 });

        // Calculate final price for each service
        const servicesWithFinalPrice = services.map(service => {
            let finalPrice = service.price || 0;
            let serviceChargeAmount = 0;
            let discountAmount = 0;

            // Calculate service charge (use serviceCharge if available, otherwise orderTax for backward compatibility)
            const chargeValue = service.serviceCharge || service.orderTax || 0;
            const chargeType = service.serviceChargeType || service.taxType || 'fixed';
            
            if (chargeValue > 0) {
                if (chargeType === 'percentage') {
                    serviceChargeAmount = (finalPrice * chargeValue) / 100;
                } else {
                    serviceChargeAmount = chargeValue;
                }
            }

            // Calculate discount
            if (service.discount > 0) {
                if (service.discountType === 'percentage') {
                    discountAmount = (finalPrice * service.discount) / 100;
                } else {
                    discountAmount = service.discount;
                }
            }

            finalPrice = finalPrice + serviceChargeAmount - discountAmount;

            return {
                ...service.toObject(),
                finalPrice: Math.max(0, finalPrice), // Ensure final price is not negative
                serviceChargeAmount,
                discountAmount
            };
        });

        res.status(200).json({
            status: 'success',
            services: servicesWithFinalPrice
        });
    } catch (error) {
        console.error('Error searching services:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
};

// Get service for update
exports.getServiceForUpdate = async (req, res) => {
    try {
        const { id } = req.params;

        const service = await Service.findById(id);
        if (!service || !service.isActive) {
            return res.status(404).json({
                status: 'error',
                message: 'Service not found'
            });
        }

        res.status(200).json({
            status: 'Success',
            service
        });
    } catch (error) {
        console.error('Error fetching service:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
};

// Update service
exports.updateService = async (req, res) => {
    try {
        const { id } = req.params;
        const { serviceName, description, price, orderTax, taxType, discount, discountType, serviceCharge, serviceChargeType } = req.body;

        // Check if another service with the same name exists
        const existingService = await Service.findOne({ 
            serviceName, 
            _id: { $ne: id },
            isActive: true 
        });
        
        if (existingService) {
            return res.status(400).json({
                status: 'error',
                message: 'Service with this name already exists'
            });
        }

        // Use serviceCharge if provided, otherwise fallback to orderTax for backward compatibility
        const finalServiceCharge = serviceCharge !== undefined ? serviceCharge : orderTax;
        const finalServiceChargeType = serviceChargeType || taxType;

        // Validate service charge value based on type
        if (finalServiceCharge) {
            if (finalServiceChargeType === 'percentage' && (finalServiceCharge < 0 || finalServiceCharge > 100)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Service charge percentage must be between 0 and 100'
                });
            }
            if (finalServiceChargeType === 'fixed' && finalServiceCharge < 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Fixed service charge amount cannot be negative'
                });
            }
        }

        // Validate discount value based on type
        if (discount) {
            if (discountType === 'percentage' && (discount < 0 || discount > 100)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Discount percentage must be between 0 and 100'
                });
            }
            if (discountType === 'fixed' && discount < 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Fixed discount amount cannot be negative'
                });
            }
        }

        const updatedService = await Service.findByIdAndUpdate(
            id,
            {
                serviceName,
                description,
                price: price ? parseFloat(price) : null,
                orderTax: orderTax ? parseFloat(orderTax) : 0, // Keep for backward compatibility
                taxType: taxType || 'fixed',
                serviceCharge: finalServiceCharge ? parseFloat(finalServiceCharge) : 0,
                serviceChargeType: finalServiceChargeType || 'fixed',
                discount: discount ? parseFloat(discount) : 0,
                discountType: discountType || 'fixed',
                updatedAt: Date.now()
            },
            { new: true }
        );

        if (!updatedService) {
            return res.status(404).json({
                status: 'error',
                message: 'Service not found'
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Service updated successfully',
            service: updatedService
        });
    } catch (error) {
        console.error('Error updating service:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
};

// Delete service (soft delete)
exports.deleteService = async (req, res) => {
    try {
        const { id } = req.params;

        const service = await Service.findByIdAndUpdate(
            id,
            { isActive: false, updatedAt: Date.now() },
            { new: true }
        );

        if (!service) {
            return res.status(404).json({
                status: 'error',
                message: 'Service not found'
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Service deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting service:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
};