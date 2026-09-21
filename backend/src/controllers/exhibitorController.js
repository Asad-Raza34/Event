'use strict';

const exhibitorService = require('../services/exhibitorService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');

// ---- Own profile ---------------------------------------------------------

const getMyProfile = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Exhibitor workspace loaded', data: await exhibitorService.getMyProfile(req.user) }),
);

const updateProfile = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Company profile updated', data: await exhibitorService.updateProfile(req.user, req.body) }),
);

const uploadLogo = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Logo updated', data: await exhibitorService.uploadAsset(req.user, 'logo', req.file) }),
);

const uploadBanner = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Banner updated', data: await exhibitorService.uploadAsset(req.user, 'banner', req.file) }),
);

// ---- Documents ----------------------------------------------------------

const addDocument = asyncHandler(async (req, res) =>
  sendCreated(res, 'Document uploaded', await exhibitorService.addDocument(req.user, req.file, req.body)),
);

const removeDocument = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Document removed', data: await exhibitorService.removeDocument(req.user, req.params.documentId) }),
);

const reviewDocument = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: 'Document reviewed',
    data: await exhibitorService.reviewDocument(req.params.id, req.params.documentId, req.body, req.user),
  }),
);

// ---- Products -----------------------------------------------------------

const listProducts = asyncHandler(async (req, res) => {
  const data = await exhibitorService.listProducts(req.query, req.query.exhibitor || null);
  return sendSuccess(res, { message: 'Products loaded', data: data.items, meta: data.meta });
});

const myProducts = asyncHandler(async (req, res) => {
  const profile = await exhibitorService.requireProfile(req.user);
  const data = await exhibitorService.listProducts({ ...req.query, active: 'all' }, profile._id);
  return sendSuccess(res, { message: 'Products loaded', data: data.items, meta: data.meta });
});

const createProduct = asyncHandler(async (req, res) =>
  sendCreated(res, 'Product added', await exhibitorService.createProduct(req.user, req.body)),
);

const updateProduct = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Product updated', data: await exhibitorService.updateProduct(req.user, req.params.id, req.body) }),
);

const removeProduct = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Product removed', data: await exhibitorService.removeProduct(req.user, req.params.id) }),
);

// ---- Staff --------------------------------------------------------------

const addStaff = asyncHandler(async (req, res) => sendCreated(res, 'Staff member added', await exhibitorService.addStaff(req.user, req.body)));

const updateStaff = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Staff member updated', data: await exhibitorService.updateStaff(req.user, req.params.staffId, req.body) }),
);

const removeStaff = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Staff member removed', data: await exhibitorService.removeStaff(req.user, req.params.staffId) }),
);

// ---- Applications -------------------------------------------------------

const apply = asyncHandler(async (req, res) =>
  sendCreated(res, 'Application submitted — the organizers will review it shortly', await exhibitorService.applyToExpo(req.user, req.body)),
);

const myApplications = asyncHandler(async (req, res) => {
  const profile = await exhibitorService.requireProfile(req.user);
  const data = await exhibitorService.listApplications(req.query, profile._id);
  return sendSuccess(res, { message: 'Applications loaded', data: data.items, meta: data.meta });
});

const withdraw = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Application withdrawn', data: await exhibitorService.withdrawApplication(req.user, req.params.id) }),
);

const listApplications = asyncHandler(async (req, res) => {
  const data = await exhibitorService.listApplications(req.query);
  return sendSuccess(res, { message: 'Applications loaded', data: data.items, meta: data.meta });
});

const reviewApplication = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: `Application ${req.body.status}`,
    data: await exhibitorService.reviewApplication(req.params.id, req.body, req.user),
  }),
);

const updateVerification = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Verification updated', data: await exhibitorService.updateVerification(req.params.id, req.body, req.user) }),
);

// ---- Public -------------------------------------------------------------

const directory = asyncHandler(async (req, res) => {
  const data = await exhibitorService.listExhibitors(req.query);
  return sendSuccess(res, { message: 'Exhibitors loaded', data: data.items, meta: data.meta });
});

const profile = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: 'Exhibitor loaded',
    data: await exhibitorService.getExhibitor(req.params.id, req.user, req.query.source || 'directory'),
  }),
);

const myExpos = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Your expos loaded', data: await exhibitorService.myExpos(req.user) }),
);

module.exports = {
  getMyProfile,
  updateProfile,
  uploadLogo,
  uploadBanner,
  addDocument,
  removeDocument,
  reviewDocument,
  listProducts,
  myProducts,
  createProduct,
  updateProduct,
  removeProduct,
  addStaff,
  updateStaff,
  removeStaff,
  apply,
  myApplications,
  withdraw,
  listApplications,
  reviewApplication,
  updateVerification,
  directory,
  profile,
  myExpos,
};
