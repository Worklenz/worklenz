'use strict';
// Roles & Permissions: adds organization-level permissions to every team's
// default permission scheme. Custom schemes are project-scoped and do not
// receive organization permissions.

const ORGANIZATION_GRANTS = [
  ['Manage organization settings', ['Owner', 'Admin']],
  ['Manage billing',               ['Owner']],
  ['Manage users',                 ['Owner', 'Admin']],
  ['Manage teams',                 ['Owner', 'Admin']],
  ['Create projects',              ['Owner', 'Admin', 'Team Lead']],
  ['View all projects',            ['Owner', 'Admin']],
  ['View reports',                 ['Owner', 'Admin', 'Team Lead']],
  ['Manage clients',               ['Owner', 'Admin']],
];

const ROLES = ['Owner', 'Admin', 'Team Lead', 'Member', 'Guest'];

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  const values = ORGANIZATION_GRANTS.flatMap(([permission, grantedRoles]) =>
    ROLES.map(role => `('${role}', '${permission}', ${grantedRoles.includes(role)})`)
  ).join(',\n      ');

  pgm.sql(`
    INSERT INTO permission_scheme_grants (scheme_id, role_name, permission, granted)
    SELECT ps.id, v.role_name, v.permission, v.granted
    FROM permission_schemes ps
    CROSS JOIN (VALUES
      ${values}
    ) AS v(role_name, permission, granted)
    WHERE ps.is_default = TRUE
    ON CONFLICT (scheme_id, role_name, permission) DO NOTHING;
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  const permissions = ORGANIZATION_GRANTS.map(([permission]) => `'${permission}'`).join(', ');

  pgm.sql(`
    DELETE FROM permission_scheme_grants
    WHERE permission IN (${permissions});
  `);
};
