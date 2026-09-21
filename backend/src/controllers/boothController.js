'use strict';

const boothService = require('../services/boothService');
const qrService = require('../services/qrService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');

const list = asyncHandler(async (req, res) => {
  // Supports both /booths?expo=… and the nested /expos/:expoId/booths form.
  const data = await boothService.listBooths({ ...req.query, expo: req.params.expoId || req.query.expo });
  return sendSuccess(res, { message: 'Booths loaded', data: data.items, meta: data.meta });
});

const detail = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Booth loaded', data: await boothService.getBooth(req.params.id) }),
);

const findByNumber = asyncHandler(async (req, res) => {
  const { expo, number } = req.query;
  if (!expo || !number) throw ApiError.badRequest('Provide the expo id and a booth label, e.g. ?expo=<id>&number=B-12');
  return sendSuccess(res, { message: 'Booth located', data: await boothService.findByNumber(expo, number) });
});

const create = asyncHandler(async (req, res) => sendCreated(res, 'Booth created', await boothService.createBooth(req.body, req.user)));

const bulkCreate = asyncHandler(async (req, res) =>
  sendCreated(res, 'Booths generated', await boothService.bulkCreateBooths(req.params.expoId, req.body, req.user)),
);

const update = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Booth updated', data: await boothService.updateBooth(req.params.id, req.body, req.user) }),
);

const updateStatus = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: `Booth marked ${req.body.status}`,
    data: await boothService.updateStatus(req.params.id, req.body.status, req.user, req.body.note),
  }),
);

const remove = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Booth deleted', data: await boothService.deleteBooth(req.params.id, req.user) }),
);

const requestReservation = asyncHandler(async (req, res) =>
  sendCreated(res, 'Booth request sent to the organizers', await boothService.requestReservation(req.params.id, req.user, req.body.note)),
);

const approveReservation = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: 'Booth reservation approved',
    data: await boothService.approveReservation(req.params.id, req.user, req.body),
  }),
);

const rejectReservation = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: 'Booth reservation declined',
    data: await boothService.rejectReservation(req.params.id, req.user, req.body.reason),
  }),
);

const assign = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: 'Booth assigned',
    data: await boothService.assignBooth(req.params.id, req.body.exhibitorId, req.user, { applicationId: req.body.applicationId }),
  }),
);

const release = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Booth released', data: await boothService.releaseBooth(req.params.id, req.user, req.body.reason) }),
);

const pending = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Pending booth requests', data: await boothService.pendingReservations(req.query.expo) }),
);

const occupancy = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Occupancy by zone', data: await boothService.occupancyByZone(req.params.expoId) }),
);

/** Signed QR code for the booth sign — scanned by staff/attendees at the stand. */
const boothQr = asyncHandler(async (req, res) => {
  const booth = await boothService.getBooth(req.params.id);
  const qr = await qrService.generateBoothQr({ booth, expo: booth.expo });
  return sendSuccess(res, { message: 'Booth QR code generated', data: qr });
});

module.exports = {
  list,
  detail,
  findByNumber,
  create,
  bulkCreate,
  update,
  updateStatus,
  remove,
  requestReservation,
  approveReservation,
  rejectReservation,
  assign,
  release,
  pending,
  occupancy,
  boothQr,
};
