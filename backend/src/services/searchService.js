'use strict';

const { Expo, ExhibitorProfile, Product, Session, Speaker, Booth } = require('../models');
const ApiError = require('../utils/ApiError');
const { escapeRegex } = require('../utils/pagination');

/**
 * Global search used by the command palette and the public search page.
 * Each collection is queried with a scoped regex and capped so the response
 * stays small and fast regardless of dataset size.
 */
const globalSearch = async (query = {}, user = null) => {
  const term = String(query.q || '').trim();
  if (term.length < 2) throw ApiError.badRequest('Enter at least two characters to search');
  const regex = new RegExp(escapeRegex(term), 'i');
  const limit = Math.min(Number(query.limit) || 6, 20);
  const types = query.type ? String(query.type).split(',').map((t) => t.trim()) : ['expos', 'exhibitors', 'products', 'sessions', 'speakers', 'booths'];
  const include = (type) => types.includes(type) || types.includes('all');

  const [expos, exhibitors, products, sessions, speakers, booths] = await Promise.all([
    include('expos')
      ? Expo.find({
          $or: [{ title: regex }, { description: regex }, { tags: regex }, { theme: regex }, { 'location.city': regex }],
          ...(user?.role === 'admin' ? {} : { status: { $in: ['upcoming', 'ongoing', 'completed'] } }),
        })
          .select('title slug summary startDate endDate status location banner category')
          .limit(limit)
      : [],
    include('exhibitors')
      ? ExhibitorProfile.find({ $or: [{ companyName: regex }, { description: regex }, { tagline: regex }, { categories: regex }] })
          .select('companyName logo slug categories description avgRating reviewCount')
          .limit(limit)
      : [],
    include('products')
      ? Product.find({ isActive: true, $or: [{ name: regex }, { description: regex }, { category: regex }, { tags: regex }] })
          .select('name category price currency image exhibitor')
          .populate('exhibitor', 'companyName slug logo')
          .limit(limit)
      : [],
    include('sessions')
      ? Session.find({ $or: [{ title: regex }, { description: regex }, { tags: regex }, { category: regex }], status: { $ne: 'cancelled' } })
          .select('title type date startTime endTime location capacity registeredCount expo')
          .populate('expo', 'title slug')
          .populate('speakers', 'name')
          .limit(limit)
      : [],
    include('speakers')
      ? Speaker.find({ $or: [{ name: regex }, { organization: regex }, { expertise: regex }, { title: regex }] })
          .select('name title organization photo expertise')
          .limit(limit)
      : [],
    include('booths')
      ? Booth.find({ $or: [{ number: regex }, { name: regex }, { zone: regex }] })
          .select('number zone name status price currency expo exhibitor')
          .populate('expo', 'title slug')
          .populate('exhibitor', 'companyName logo slug')
          .limit(limit)
      : [],
  ]);

  const grouped = {
    expos: expos.map((e) => ({
      id: e._id,
      type: 'expo',
      title: e.title,
      subtitle: [e.location?.city, new Date(e.startDate).toDateString()].filter(Boolean).join(' • '),
      image: e.banner,
      badge: e.status,
      link: `/expos/${e.slug}`,
    })),
    exhibitors: exhibitors.map((e) => ({
      id: e._id,
      type: 'exhibitor',
      title: e.companyName,
      subtitle: e.categories?.join(', ') || e.tagline,
      image: e.logo,
      badge: e.avgRating ? `${e.avgRating}★` : null,
      link: `/exhibitors/${e.slug}`,
    })),
    products: products.map((p) => ({
      id: p._id,
      type: 'product',
      title: p.name,
      subtitle: [p.exhibitor?.companyName, p.category].filter(Boolean).join(' • '),
      image: p.image,
      badge: p.price ? `${p.currency} ${p.price}` : null,
      link: p.exhibitor?.slug ? `/exhibitors/${p.exhibitor.slug}` : '/exhibitors',
    })),
    sessions: sessions.map((s) => ({
      id: s._id,
      type: 'session',
      title: s.title,
      subtitle: [new Date(s.date).toDateString(), `${s.startTime}–${s.endTime}`, s.location?.room].filter(Boolean).join(' • '),
      image: null,
      badge: s.type,
      link: s.expo?.slug ? `/expos/${s.expo.slug}/schedule` : '/sessions',
    })),
    speakers: speakers.map((s) => ({
      id: s._id,
      type: 'speaker',
      title: s.name,
      subtitle: [s.title, s.organization].filter(Boolean).join(' • '),
      image: s.photo,
      badge: s.expertise?.[0] || null,
      link: '/speakers',
    })),
    booths: booths.map((b) => ({
      id: b._id,
      type: 'booth',
      title: `Booth ${b.zone}-${b.number}`,
      subtitle: [b.exhibitor?.companyName || 'Available', b.expo?.title].filter(Boolean).join(' • '),
      image: b.exhibitor?.logo || null,
      badge: b.status,
      link: b.expo?.slug ? `/expos/${b.expo.slug}/floor-plan?booth=${b._id}` : '/expos',
    })),
  };

  const totals = Object.entries(grouped).reduce((acc, [key, value]) => ({ ...acc, [key]: value.length }), {});
  return { term, results: grouped, totals, totalResults: Object.values(totals).reduce((a, b) => a + b, 0) };
};

module.exports = { globalSearch };
