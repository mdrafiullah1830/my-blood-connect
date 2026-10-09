const crypto = require('crypto');
const mongoose = require('mongoose');
const Donation = require('../models/Donation');
const User = require('../models/User');
const { buildPdf, donationReportLines } = require('../services/pdf');

// donation record add — user er donationCount + lastDonationDate auto update hoy.
const addDonation = async (req, res) => {
    try {
        const { bloodGroup, hospitalName = '', city = '', bags = 1, donatedAt, note = '', requestId = null } = req.body;
        if (!bloodGroup || !donatedAt) return res.status(400).json({ success: false, message: 'Blood group and donation date are required' });
        const date = new Date(donatedAt);
        if (Number.isNaN(date.getTime()) || date > new Date()) return res.status(400).json({ success: false, message: 'Donation date cannot be in the future' });
        const bagCount = Number(bags);
        if (!Number.isInteger(bagCount) || bagCount < 1 || bagCount > 20) return res.status(400).json({ success: false, message: 'Bags must be between 1 and 20' });

        const certificateId = `BC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const donation = await Donation.create({
            donorId: req.user.id, requestId, bloodGroup, hospitalName: String(hospitalName).slice(0, 150),
            city: String(city).slice(0, 100), bags: bagCount, donatedAt: date, certificateId, note: String(note).slice(0, 300)
        });
        await User.updateOne({ _id: req.user.id }, {
            $inc: { donationCount: bagCount },
            $set: { lastDonationDate: date, isAvailable: false }
        });
        res.status(201).json({ success: true, message: 'Donation recorded', donation });
    } catch (error) {
        console.error('Donation add failed:', error);
        res.status(500).json({ success: false, message: 'Unable to record donation' });
    }
};

// donor er full donation timeline.
const listMyDonations = async (req, res) => {
    try {
        const donations = await Donation.find({ donorId: req.user.id }).sort({ donatedAt: -1 }).lean();
        const totalBags = donations.reduce((sum, d) => sum + (d.bags || 1), 0);
        res.json({ success: true, donations, totalBags, count: donations.length });
    } catch (error) {
        console.error('Donations read failed:', error);
        res.status(500).json({ success: false, message: 'Unable to load donations' });
    }
};

const getDonation = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid donation id' });
        const donation = await Donation.findOne({ _id: req.params.id, donorId: req.user.id }).lean();
        if (!donation) return res.status(404).json({ success: false, message: 'Donation not found' });
        res.json({ success: true, donation });
    } catch (error) {
        console.error('Donation read failed:', error);
        res.status(500).json({ success: false, message: 'Unable to load donation' });
    }
};

const deleteDonation = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid donation id' });
        const donation = await Donation.findOneAndDelete({ _id: req.params.id, donorId: req.user.id });
        if (!donation) return res.status(404).json({ success: false, message: 'Donation not found' });
        await User.updateOne({ _id: req.user.id }, { $inc: { donationCount: -(donation.bags || 1) } });
        res.json({ success: true, message: 'Donation removed' });
    } catch (error) {
        console.error('Donation delete failed:', error);
        res.status(500).json({ success: false, message: 'Unable to delete donation' });
    }
};

// monthly donation report — zero-dep PDF download (feature 45).
const monthlyReport = async (req, res) => {
    try {
        const month = String(req.query.month || new Date().toISOString().slice(0, 7));
        if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ success: false, message: 'month must be YYYY-MM' });
        const start = new Date(`${month}-01T00:00:00.000Z`);
        const end = new Date(start);
        end.setUTCMonth(end.getUTCMonth() + 1);

        const donations = await Donation.find({ donorId: req.user.id, donatedAt: { $gte: start, $lt: end } }).sort({ donatedAt: 1 }).lean();
        const user = await User.findById(req.user.id).select('name bloodGroup donationCount').lean();
        const lines = donationReportLines(donations, {
            donorName: user.name, bloodGroup: user.bloodGroup, period: month,
            lifetimeCount: user.donationCount
        });
        const pdf = buildPdf({ title: `Blood Connect Donation Report - ${month}`, lines, footer: 'Blood Connect - Saving lives together' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="donation-report-${month}.pdf"`);
        return res.send(pdf);
    } catch (error) {
        console.error('Monthly report failed:', error);
        return res.status(500).json({ success: false, message: 'Unable to generate report' });
    }
};

module.exports = { addDonation, listMyDonations, getDonation, deleteDonation, monthlyReport };
