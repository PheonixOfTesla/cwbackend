const Measurement = require('../models/Measurement');

exports.getMeasurementsByClient = async (req, res) => {
  try {
    const measurements = await Measurement.find({ 
      clientId: req.params.clientId 
    }).sort('-date');
    
    // FIXED: Consistent response format
    res.json({
      success: true,
      data: measurements
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

exports.createMeasurement = async (req, res) => {
  try {
    const measurement = await Measurement.create({
      ...req.body,
      clientId: req.params.clientId,
      createdBy: req.user.id  // FIXED: Use consistent .id instead of req.user._id
    });
    
    // FIXED: Consistent response format
    res.status(201).json({
      success: true,
      data: measurement
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

exports.updateMeasurement = async (req, res) => {
  try {
    const measurement = await Measurement.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!measurement) {
      return res.status(404).json({ 
        success: false,
        message: 'Measurement not found' 
      });
    }
    
    // FIXED: Consistent response format
    res.json({
      success: true,
      data: measurement
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

exports.deleteMeasurement = async (req, res) => {
  try {
    const measurement = await Measurement.findByIdAndDelete(req.params.id);
    
    if (!measurement) {
      return res.status(404).json({ 
        success: false,
        message: 'Measurement not found' 
      });
    }
    
    // FIXED: Consistent response format
    res.json({ 
      success: true,
      message: 'Measurement deleted successfully',
      data: measurement
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

exports.getMeasurementStats = async (req, res) => {
  try {
    const measurements = await Measurement.find({ 
      clientId: req.params.clientId 
    }).sort('date');
    
    if (measurements.length === 0) {
      return res.json({ 
        success: true,
        message: 'No measurements found',
        data: {
          totalMeasurements: 0,
          latestWeight: null,
          weightChange: 0,
          latestBodyFat: null,
          bodyFatChange: 0
        }
      });
    }
    
    const latest = measurements[measurements.length - 1];
    const first = measurements[0];
    
    // FIXED: Consistent response format with data wrapper
    res.json({
      success: true,
      data: {
        totalMeasurements: measurements.length,
        latestWeight: latest.weight,
        weightChange: latest.weight - first.weight,
        latestBodyFat: latest.bodyFat,
        bodyFatChange: latest.bodyFat ? (latest.bodyFat - (first.bodyFat || 0)) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};
