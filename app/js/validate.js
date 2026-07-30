// validate.js — startup manifest validation. Replaces Excel's silent
// `On Error Resume Next` shape lookups with explicit, visible reporting.

// Returns { errors: [...], warnings: [...] }. Errors are integrity problems
// that break the data<->map contract; warnings are non-fatal notes.
export function validateManifest(seed) {
  const errors = [];
  const warnings = [];

  const areaIds = seed.areas.map((a) => a.id);
  const areaIdSet = new Set(areaIds);
  const areaById = new Map(seed.areas.map((a) => [a.id, a]));

  // Duplicate area IDs
  const seen = new Set();
  for (const id of areaIds) {
    if (seen.has(id)) errors.push(`Duplicate area id: "${id}"`);
    seen.add(id);
  }

  const deptIds = new Set(seed.departments.map((d) => d.id));
  const floorIds = new Set((seed.floors || []).map((f) => f.id));
  const regionIds = new Set(Object.keys(seed.regions.regions || seed.regions));

  for (const a of seed.areas) {
    // Every area needs a map region
    if (!regionIds.has(a.mapRegionId || a.id)) {
      errors.push(`Area "${a.name}" (${a.id}) has no map region.`);
    }
    // Every area needs a valid department
    if (!deptIds.has(a.departmentId)) {
      errors.push(`Area "${a.name}" (${a.id}) references unknown department "${a.departmentId}".`);
    }
    // Every area needs a valid floor (only when the manifest declares floors)
    if (floorIds.size && !floorIds.has(a.floorId)) {
      errors.push(`Area "${a.name}" (${a.id}) references unknown floor "${a.floorId}".`);
    }
    // Every area should have an I-beam location
    if (!a.iBeamLocation) {
      warnings.push(`Area "${a.name}" (${a.id}) has no I-beam location.`);
    }
  }

  // Regions with no matching area (excluding known non-data shapes)
  const IGNORED_SHAPES = new Set(['misships', 'rectangle-37']);
  for (const rid of regionIds) {
    if (!areaIdSet.has(rid) && !IGNORED_SHAPES.has(rid)) {
      warnings.push(`Map region "${rid}" has no matching area record.`);
    }
  }

  // I-beam mappings point at real areas that live on the mapping's own floor.
  for (const m of seed.ibeamMappings) {
    for (const aid of m.areaIds) {
      const area = areaById.get(aid);
      if (!area) {
        errors.push(`I-beam "${m.iBeamLocation}" maps to unknown area "${aid}".`);
      } else if (m.floorId && area.floorId !== m.floorId) {
        errors.push(`I-beam "${m.iBeamLocation}" (floor ${m.floorId}) maps to area "${aid}" on floor ${area.floorId}.`);
      }
    }
  }

  // Every area's own I-beam should appear in the mapping table for its floor.
  const mappedIBeams = new Set(seed.ibeamMappings.map((m) => `${m.floorId} ${m.iBeamLocation}`));
  for (const a of seed.areas) {
    if (a.iBeamLocation && !mappedIBeams.has(`${a.floorId} ${a.iBeamLocation}`)) {
      warnings.push(`Area "${a.name}" I-beam "${a.iBeamLocation}" is not in the mapping table.`);
    }
  }

  return { errors, warnings };
}
