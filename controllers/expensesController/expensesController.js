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

const express = require('express');
const mongoose = require('mongoose');
const Expenses = require('../../models/expensesModel')
const generateReferenceId = require('../../utils/generateReferenceID');
const { formatToSriLankaTime } = require('../../utils/timeZone');

const createExpenses = async (req, res) => {
        const session = await mongoose.startSession();
        session.startTransaction();
    const { warehouse, category, amount, title, details } = req.body; // Remove date from destructuring

     // Generate a reference ID for the sale
     const referenceId = await generateReferenceId('EXPENSE');

    // Collect missing fields (remove date validation)
    const missingFields = [];
    if (!warehouse) missingFields.push('warehouse');
    if (!category) missingFields.push('category');
    if (!amount) missingFields.push('amount');
    if (!title) missingFields.push('title');
    // Note: Date is no longer required from frontend

    if (missingFields.length > 0) {
        return res.status(400).json({
            message: 'Validation Error: Missing required fields',
            missingFields,
            status: 'fail',
        });
    }

    try {
        // Check for duplicate expense
        const existingExpense = await Expenses.findOne({ category, title });
        if (existingExpense) {
            return res.status(409).json({
                message: 'Expense with the same category and title already exists',
                status: 'fail',
                data: existingExpense,
            });
        }

        // Create and save the expense
        const expenseDate = new Date(); // Get server UTC time
        const newExpenses = new Expenses({
            refferenceId: referenceId, 
            warehouse,
            category,
            amount,
            date: expenseDate, // Use server UTC time
            title,
            details,
        });
        await newExpenses.save();
        await session.commitTransaction();

        // Log formatted creation time for expense
        const formattedExpenseTime = formatToSriLankaTime(newExpenses.date);
        console.log("✅ Expense Created Successfully:", {
            referenceId: newExpenses.refferenceId,
            createdAt: formattedExpenseTime.full,
            createdAtISO: formattedExpenseTime.iso,
            category: newExpenses.category,
            amount: newExpenses.amount,
            timezone: "Sri Lanka Time (UTC+05:30)"
        });

        res.status(201).json({
            message: 'Expense created successfully',
            status: 'success',
            data: {
                ...newExpenses.toObject(),
                formattedDate: {
                    full: formattedExpenseTime.full,
                    dateOnly: formattedExpenseTime.dateOnly,
                    timeOnly: formattedExpenseTime.timeOnly,
                    iso: formattedExpenseTime.iso
                }
            },
        });
    } catch (error) {
        console.error('Error in createExpenses:', error);
        res.status(500).json({
            message: 'Internal Server Error: Unable to create expense',
            status: 'fail',
            error: error.message,
        });
    }
};
const getAllExpenses = async (req, res) => {
    try {
        const expenses = await Expenses.find(); // Fetch all expenses documents
        
        // Add formatted dates to expenses
        const expensesWithFormattedDates = expenses.map(expense => {
            const formattedTime = formatToSriLankaTime(expense.date);
            return {
                ...expense.toObject(),
                formattedDate: {
                    full: formattedTime.full,
                    dateOnly: formattedTime.dateOnly,
                    timeOnly: formattedTime.timeOnly,
                    iso: formattedTime.iso
                }
            };
        });
        
        res.status(200).json({ data: expensesWithFormattedDates });
    } catch (error) {
        res.status(500).json({ message: 'Failed to retrieve expenses,Please try again', error: error.message });
    }
};

//Delete currency
const deleteCExpenses = async (req, res) => {
    const { id } = req.params;
    try {
        const deletedExpenses = await Expenses.findByIdAndDelete(id);
        if (!deletedExpenses) {
            return res.status(404).json({ success: false, message: 'Expenses not found' });
        }

        res.status(200).json({ success: true, message: 'Expenses deleted successfully', data: deletedExpenses });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete Expenses, try again', error: error.message });
    }
};


const getExpensesByCategory = async (req, res) => {
    const { category } = req.query;
    try {
        const expenses = await Expenses.find({
            category: { $regex: new RegExp(category, 'i') }
        });
        if (expenses.length === 0) {
            return res.status(404).json({ message: 'No expenses found' });
        }
        
        // Add formatted dates to expenses
        const expensesWithFormattedDates = expenses.map(expense => {
            const formattedTime = formatToSriLankaTime(expense.date);
            return {
                ...expense.toObject(),
                formattedDate: {
                    full: formattedTime.full,
                    dateOnly: formattedTime.dateOnly,
                    timeOnly: formattedTime.timeOnly,
                    iso: formattedTime.iso
                }
            };
        });
        
        res.status(200).json({ data: expensesWithFormattedDates });
    } catch (error) {
        res.status(500).json({ message: 'Failed to search expenses,Try again', error: error.message });
    }
};

const findExpensesById = async (req, res) => {
    const { id } = req.params;
    try {
        const expenses = await Expenses.findById(id);
        if (!expenses) {
            return res.status(404).json({ message: 'expenses not found' });
        }
        
        // Format the expense date for display
        const formattedExpenseDate = formatToSriLankaTime(expenses.date);
        
        const expenseWithFormattedDate = {
            ...expenses.toObject(),
            formattedDate: {
                full: formattedExpenseDate.full,
                dateOnly: formattedExpenseDate.dateOnly,
                timeOnly: formattedExpenseDate.timeOnly,
                iso: formattedExpenseDate.iso
            }
        };
        
        res.status(200).json({ data: expenseWithFormattedDate });
    } catch (error) {
        res.status(500).json({ message: 'Failed to retrieve expenses,Try again', error: error.message });
    }
};

const updateExpenses = async (req, res) => {
    const { id } = req.params;
    const { warehouse, category, amount, title, details } = req.body; // Remove date from destructuring

    // Collect missing fields (remove date validation)
    const missingFields = [];
    if (!warehouse) missingFields.push('warehouse');
    if (!category) missingFields.push('category');
    if (!amount) missingFields.push('amount');
    if (!title) missingFields.push('title');
    // Note: Date is no longer required from frontend

    if (missingFields.length > 0) {
        return res.status(400).json({
            message: 'Validation Error: Missing required fields',
            missingFields,
            status: 'fail',
        });
    }

    try {
        // Update expense (preserve original date unless explicitly updating)
        const updatedExpenses = await Expenses.findByIdAndUpdate(
            id,
            { warehouse, category, amount, title, details }, // Remove date from update to preserve original
            { new: true } // Return updated document
        );

        if (!updatedExpenses) {
            return res.status(404).json({
                message: 'Expense not found',
                status: 'fail',
            });
        }

        // Log formatted update time for expense
        const formattedUpdateTime = formatToSriLankaTime(updatedExpenses.date);
        console.log("✅ Expense Updated Successfully:", {
            referenceId: updatedExpenses.refferenceId,
            updatedAt: formattedUpdateTime.full,
            updatedAtISO: formattedUpdateTime.iso,
            category: updatedExpenses.category,
            amount: updatedExpenses.amount,
            timezone: "Sri Lanka Time (UTC+05:30)"
        });

        res.status(200).json({
            message: 'Expense updated successfully',
            status: 'success',
            data: {
                ...updatedExpenses.toObject(),
                formattedDate: {
                    full: formattedUpdateTime.full,
                    dateOnly: formattedUpdateTime.dateOnly,
                    timeOnly: formattedUpdateTime.timeOnly,
                    iso: formattedUpdateTime.iso
                }
            },
        });
    } catch (error) {
        console.error('Error in updateExpenses:', error);
        res.status(500).json({
            message: 'Internal Server Error: Unable to update expense',
            status: 'fail',
            error: error.message,
        });
    }
};


const getExpenses = async (req, res) => {
    const { id, keyword } = req.query;

    try {
        let expenses;

        if (id) {
            // Fetch by ID
            expenses = await Expenses.findById(id);
            if (!expenses) {
                return res.status(404).json({ message: 'Expense not found' });
            }
            expenses = [expenses]; // Wrap in array for consistent format
        } else if (keyword) {
            // Fetch by keyword (matches category or referenceId)
            expenses = await Expenses.find({
                $or: [
                    { category: { $regex: new RegExp(keyword, 'i') } },
                    { refferenceId: { $regex: new RegExp(keyword, 'i') } }
                ]
            });
            if (expenses.length === 0) {
                return res.status(404).json({ message: 'No expenses found for the specified keyword' });
            }
        } else {
            if (req.query.page) {
                const size = parseInt(req.query.page.size) || 10; // Default size is 10
                const number = parseInt(req.query.page.number) || 1; // Default page number is 1
                const offset = (number - 1) * size; // Calculate the offset for pagination
                
                expenses = await Expenses.find()
                    .skip(offset)
                    .limit(size)
                    .sort({ createdAt: -1 })

                if (expenses.length === 0) {
                    return res.status(404).json({ message: 'No expenses found' });
                }

                const total = await Expenses.countDocuments();
                const totalPages = Math.ceil(total / size);

                // Add formatted dates to paginated expenses
                const expensesWithFormattedDates = expenses.map(expense => {
                    const formattedTime = formatToSriLankaTime(expense.date);
                    return {
                        ...expense.toObject(),
                        formattedDate: {
                            full: formattedTime.full,
                            dateOnly: formattedTime.dateOnly,
                            timeOnly: formattedTime.timeOnly,
                            iso: formattedTime.iso
                        }
                    };
                });

                return res.status(200).json({
                    data: expensesWithFormattedDates,
                    total,
                    totalPages,
                    currentPage: number,
                    pageSize: size
                });
            }

            // Fetch all expenses without pagination
            expenses = await Expenses.find();
            if (expenses.length === 0) {
                return res.status(404).json({ message: 'No expenses found' });
            }
            
            // Add formatted dates to all expenses
            const expensesWithFormattedDates = expenses.map(expense => {
                const formattedTime = formatToSriLankaTime(expense.date);
                return {
                    ...expense.toObject(),
                    formattedDate: {
                        full: formattedTime.full,
                        dateOnly: formattedTime.dateOnly,
                        timeOnly: formattedTime.timeOnly,
                        iso: formattedTime.iso
                    }
                };
            });
            
            res.status(200).json({ data: expensesWithFormattedDates });
        }

        // Add formatted dates to single expense or keyword search results
        const expensesWithFormattedDates = expenses.map(expense => {
            const formattedTime = formatToSriLankaTime(expense.date);
            return {
                ...expense.toObject(),
                formattedDate: {
                    full: formattedTime.full,
                    dateOnly: formattedTime.dateOnly,
                    timeOnly: formattedTime.timeOnly,
                    iso: formattedTime.iso
                }
            };
        });
        
        res.status(200).json({ data: expensesWithFormattedDates });
    } catch (error) {
        console.error('Error retrieving expenses:', error);
        res.status(500).json({ message: 'Failed to retrieve expenses, try again', error: error.message });
    }
};

const searchExpense = async (req, res) => {
    const { keyword } = req.query; // Get keyword from query params

    try {
        if (!keyword) {
            return res.status(400).json({ 
                status: "error", 
                message: "Keyword is required for searching expenses." 
            });
        }

        // Escape special regex characters in the keyword to prevent regex injection
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Build query to search by category or referenceId
        const query = {
            $or: [
                { category: { $regex: new RegExp(`${escapedKeyword}`, 'i') } }, // Case-insensitive search for category
                { refferenceId: { $regex: new RegExp(`${escapedKeyword}`, 'i') } } // Case-insensitive search for referenceId
            ]
        };

        // Fetch expenses based on the query
        const expenses = await Expenses.find(query).sort({ createdAt: -1 }); // Sort by creation date (most recent first)

        if (!expenses || expenses.length === 0) {
            return res.status(404).json({ 
                status: "unsuccess", 
                message: "No expenses found for the provided keyword." 
            });
        }

        // Format the fetched expenses if additional processing is needed
        const formattedExpenses = expenses.map((expense) => {
            const expenseObj = expense.toObject();
            const formattedTime = formatToSriLankaTime(expenseObj.date);
            
            return {
                _id: expenseObj._id,
                category: expenseObj.category,
                refferenceId: expenseObj.refferenceId,
                amount: expenseObj.amount,
                date: expenseObj.date,
                formattedDate: {
                    full: formattedTime.full,
                    dateOnly: formattedTime.dateOnly,
                    timeOnly: formattedTime.timeOnly,
                    iso: formattedTime.iso
                },
                title: expenseObj.title,
                warehouse: expenseObj.warehouse,
                description: expenseObj.description,
                details: expenseObj.details,
                createdAt: expenseObj.createdAt 
                    ? formatToSriLankaTime(expenseObj.createdAt).dateOnly
                    : null,
            };
        });

        return res.status(200).json({ 
            status: "success", 
            expenses: formattedExpenses 
        });
    } catch (error) {
        console.error("Search expenses error:", error);
        return res.status(500).json({ 
            status: "error", 
            message: error.message 
        });
    }
};



module.exports = { createExpenses, getAllExpenses, deleteCExpenses, getExpensesByCategory, findExpensesById, updateExpenses, getExpenses, searchExpense }