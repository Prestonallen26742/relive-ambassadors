// Credit and stats math for the ambassador tracker. No page code here, so it can be tested on its own.
(function (root) {
  const GOAL = 500;
  const MONTHLY_CREDIT = 10;
  const STATUSES = ['Prospect', 'Contacted', 'Onboarded', 'Active', 'Inactive'];
  const STAGES = ['New', 'Booked labs', 'Labs done', 'Recurring member', 'Cancelled', 'Lost'];
  const CONVERTED = ['Recurring member', 'Cancelled'];

  function todayStr(now) {
    const d = now || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function parts(s) {
    const p = String(s || '').split('-').map(Number);
    return p.length === 3 && p[0] && p[1] && p[2] ? p : null;
  }

  // Full calendar months between two YYYY-MM-DD dates (until defaults to today).
  function fullMonths(since, until, now) {
    const a = parts(since);
    if (!a) return 0;
    const b = parts(until) || parts(todayStr(now));
    return Math.max(0, (b[0] - a[0]) * 12 + (b[1] - a[1]) - (b[2] < a[2] ? 1 : 0));
  }

  // $100 for each of the first 2 recurring referrals, $150 for each after that.
  function referralBonus(n) {
    let s = 0;
    for (let i = 1; i <= n; i++) s += i <= 2 ? 100 : 150;
    return s;
  }

  function tierFor(n) {
    return n >= 10 ? 'Elite' : n >= 3 ? 'Ambassador' : n >= 1 ? 'Insider' : 'None yet';
  }

  function computeBoard(ambassadors, leads, now) {
    return (ambassadors || []).map(function (a) {
      const mine = (leads || []).filter(function (l) { return l.ambassadorId === a.id; });
      const labs = mine.filter(function (l) { return ['Labs done'].concat(CONVERTED).indexOf(l.stage) >= 0; }).length;
      const converted = mine.filter(function (l) { return CONVERTED.indexOf(l.stage) >= 0; });
      const recurring = mine.filter(function (l) { return l.stage === 'Recurring member'; }).length;
      const bonus = referralBonus(converted.length);
      const months = converted.reduce(function (s, l) {
        return s + fullMonths(l.recurringSince, l.stage === 'Cancelled' ? l.cancelledOn : '', now);
      }, 0);
      const monthly = months * MONTHLY_CREDIT;
      const earned = bonus + monthly;
      const redeemed = Number(a.redeemed) || 0;
      return {
        id: a.id, name: String(a.name || ''), type: String(a.type || ''), status: String(a.status || ''),
        code: String(a.code || ''), contact: String(a.contact || ''),
        leads: mine.length, labs: labs, converted: converted.length, recurring: recurring,
        conv: mine.length ? Math.round((converted.length / mine.length) * 100) : 0,
        tier: tierFor(converted.length),
        bonus: bonus, monthly: monthly, perMonth: recurring * MONTHLY_CREDIT,
        earned: earned, redeemed: redeemed, owed: Math.max(0, earned - redeemed),
      };
    }).sort(function (x, y) {
      return y.recurring - x.recurring || y.leads - x.leads || x.name.localeCompare(y.name);
    });
  }

  function sum(rows, f) { return rows.reduce(function (s, r) { return s + (f(r) || 0); }, 0); }

  function computeTotals(board, leads, now) {
    const month = todayStr(now).slice(0, 7);
    const recurring = sum(board, function (r) { return r.recurring; });
    return {
      active: board.filter(function (r) { return r.status === 'Active' || r.status === 'Onboarded'; }).length,
      ambassadors: board.length,
      leads: leads.length,
      leadsMonth: leads.filter(function (r) { return String(r.date || '').slice(0, 7) === month; }).length,
      recurring: recurring,
      conv: leads.length ? Math.round((sum(board, function (r) { return r.converted; }) / leads.length) * 100) : 0,
      pct: Math.round((recurring / GOAL) * 100),
      owed: sum(board, function (r) { return r.owed; }),
      perMonth: sum(board, function (r) { return r.perMonth; }),
    };
  }

  function mondayOf(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = (x.getDay() + 6) % 7; // Monday = 0
    x.setDate(x.getDate() - day);
    return x;
  }

  function computeWeekly(leads, now) {
    const thisWeek = mondayOf(now || new Date());
    const weeks = [];
    for (let i = 11; i >= 0; i--) {
      const w = new Date(thisWeek);
      w.setDate(w.getDate() - i * 7);
      weeks.push({ week: todayStr(w), leads: 0, recurring: 0 });
    }
    const index = {};
    weeks.forEach(function (w, i) { index[w.week] = i; });
    (leads || []).forEach(function (l) {
      const p = parts(l.date);
      if (!p) return;
      const i = index[todayStr(mondayOf(new Date(p[0], p[1] - 1, p[2])))];
      if (i == null) return;
      weeks[i].leads += 1;
      if (l.stage === 'Recurring member') weeks[i].recurring += 1;
    });
    return weeks;
  }

  function computeFunnel(leads) {
    const l = leads || [];
    const reached = function (stages) { return l.filter(function (r) { return stages.indexOf(r.stage) >= 0; }).length; };
    return [
      { stage: 'Leads', n: l.length },
      { stage: 'Booked labs', n: reached(['Booked labs', 'Labs done'].concat(CONVERTED)) },
      { stage: 'Labs done', n: reached(['Labs done'].concat(CONVERTED)) },
      { stage: 'Became recurring', n: reached(CONVERTED) },
      { stage: 'Still recurring', n: reached(['Recurring member']) },
    ];
  }

  const api = {
    GOAL: GOAL, MONTHLY_CREDIT: MONTHLY_CREDIT, STATUSES: STATUSES, STAGES: STAGES,
    todayStr: todayStr, fullMonths: fullMonths, referralBonus: referralBonus, tierFor: tierFor,
    computeBoard: computeBoard, computeTotals: computeTotals, computeWeekly: computeWeekly, computeFunnel: computeFunnel,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AmbLogic = api;
})(this);
