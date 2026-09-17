'use strict';

const { FloorPlan, Booth, Expo } = require('../models');
const ApiError = require('../utils/ApiError');
const { emitToExpo, EVENTS } = require('../sockets/emitter');

const getOrCreatePlan = async (expoId, user) => {
  const expo = await Expo.findById(expoId);
  if (!expo) throw ApiError.notFound('Expo not found');

  let plan = await FloorPlan.findOne({ expo: expoId });
  if (!plan) {
    plan = await FloorPlan.create({
      expo: expoId,
      name: `${expo.title} — Main Hall`,
      zones: [
        { name: 'A', color: '#6366f1', description: 'Premium front-of-house zone' },
        { name: 'B', color: '#06b6d4', description: 'Central showcase zone' },
      ],
      updatedBy: user?._id,
    });
    expo.floorPlan = plan._id;
    await expo.save();
  }
  return plan;
};

/** Floor plan plus every booth placed on it — the payload the UI renders. */
const getLayout = async (expoId, user) => {
  const plan = await getOrCreatePlan(expoId, user);
  const booths = await Booth.find({ expo: expoId })
    .populate('exhibitor', 'companyName logo slug categories description avgRating reviewCount contact website')
    .sort({ zone: 1, number: 1 });

  const summary = booths.reduce(
    (acc, booth) => {
      acc.total += 1;
      acc[booth.status] = (acc[booth.status] || 0) + 1;
      return acc;
    },
    { total: 0, available: 0, reserved: 0, occupied: 0, maintenance: 0 },
  );

  return { plan, booths, summary };
};

const updatePlan = async (expoId, payload, user) => {
  if (!user || user.role !== 'admin') throw ApiError.forbidden('Only organizers can edit floor plans');
  const expo = await Expo.findById(expoId);
  if (!expo) throw ApiError.notFound('Expo not found');
  if (!expo.isOwner(user)) throw ApiError.forbidden('You can only edit floor plans for your own expos');

  const plan = await getOrCreatePlan(expoId, user);
  Object.assign(plan, {
    name: payload.name ?? plan.name,
    width: payload.width ?? plan.width,
    height: payload.height ?? plan.height,
    gridCols: payload.gridCols ?? plan.gridCols,
    gridRows: payload.gridRows ?? plan.gridRows,
    backgroundImage: payload.backgroundImage ?? plan.backgroundImage,
    zones: payload.zones ?? plan.zones,
    amenities: payload.amenities ?? plan.amenities,
    notes: payload.notes ?? plan.notes,
    updatedBy: user._id,
  });
  await plan.save();
  emitToExpo(expoId, EVENTS.BOOTH_UPDATED, { expoId, action: 'floor-plan-updated' });
  return plan;
};

/** Grow (never shrink) the grid so newly generated booths always fit. */
const expandGrid = async (floorPlanId, { cols, rows }) => {
  const plan = await FloorPlan.findById(floorPlanId);
  if (!plan) return null;
  plan.gridCols = Math.max(plan.gridCols, Math.min(80, Math.ceil(cols)));
  plan.gridRows = Math.max(plan.gridRows, Math.min(80, Math.ceil(rows)));
  await plan.save();
  return plan;
};

module.exports = { getOrCreatePlan, getLayout, updatePlan, expandGrid };
