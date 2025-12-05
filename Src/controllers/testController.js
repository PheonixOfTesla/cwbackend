const Test = require('../models/Test');

exports.getTestsByClient = async (req, res) => {
  try {
    const tests = await Test.find({ 
      clientId: req.params.clientId 
    }).sort('-date');
    
    // FIXED: Consistent response format with data wrapper
    res.json({
      success: true,
      data: tests
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

exports.createTest = async (req, res) => {
  try {
    const test = await Test.create({
      ...req.body,
      clientId: req.params.clientId,
      performedBy: req.user.id,  // FIXED: Use consistent .id instead of req.user._id
      date: req.body.date || new Date()
    });
    
    // FIXED: Consistent response format
    res.status(201).json({
      success: true,
      data: test,
      message: 'Test recorded successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

exports.updateTest = async (req, res) => {
  try {
    const test = await Test.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!test) {
      return res.status(404).json({ 
        success: false,
        message: 'Test not found' 
      });
    }
    
    // FIXED: Consistent response format
    res.json({
      success: true,
      data: test,
      message: 'Test updated successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

exports.deleteTest = async (req, res) => {
  try {
    const test = await Test.findByIdAndDelete(req.params.id);
    
    if (!test) {
      return res.status(404).json({ 
        success: false,
        message: 'Test not found' 
      });
    }
    
    // FIXED: Consistent response format
    res.json({ 
      success: true,
      message: 'Test deleted successfully',
      data: test
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};
