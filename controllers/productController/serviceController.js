const Service = require('../../models/products/productService');

// Create a new service
exports.createService = async (req, res) => {
    try {
        const { serviceName, description, price, duration } = req.body;

        // Check if service already exists
        const existingService = await Service.findOne({ serviceName });
        if (existingService) {
            return res.status(400).json({
                status: 'error',
                message: 'Service with this name already exists'
            });
        }

        // Create new service
        const newService = new Service({
            serviceName,
            description,
            price,
            duration
        });

        await newService.save();

        res.status(201).json({
            status: 'success',
            message: 'Service created successfully',
            service: newService
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

        const totalServices = await Service.countDocuments({ isActive: true });
        const totalPages = Math.ceil(totalServices / size);

        res.status(200).json({
            status: 'success',
            services,
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

// Search services by name
exports.searchService = async (req, res) => {
    try {
        const { serviceName } = req.query;

        if (!serviceName) {
            return res.status(400).json({
                status: 'error',
                message: 'Service name is required for search'
            });
        }

        const services = await Service.find({
            serviceName: { $regex: serviceName, $options: 'i' },
            isActive: true
        }).sort({ createdAt: -1 });

        res.status(200).json({
            status: 'success',
            services
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
        const { serviceName, description, price, duration } = req.body;

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

        const updatedService = await Service.findByIdAndUpdate(
            id,
            {
                serviceName,
                description,
                price,
                duration,
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