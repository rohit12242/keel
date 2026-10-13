/**
 * I-02 step 2 — the user row as sign-in needs it (ADR-002, ERD *User*).
 *
 *   idp_subject: the provider's subject id. A sign-in finds its user by this,
 *                or creates one; nothing matches by email. Nullable only for a
 *                row written before sign-in existed, which nobody signs in as.
 *   password_hash: dropped. Credentials live at the provider and Keel never
 *                receives one; the column was never written and nothing reads
 *                it ("No password, ever").
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE "user" ADD COLUMN idp_subject text;
    ALTER TABLE "user"
      ADD CONSTRAINT user_idp_subject_key UNIQUE (idp_subject);

    ALTER TABLE "user" DROP COLUMN password_hash;
  `);
};

exports.down = (pgm) => {
  // Restores the shape, not the subjects: a row signed in through the provider
  // loses its link to it.
  pgm.sql(`
    ALTER TABLE "user" ADD COLUMN password_hash text;
    ALTER TABLE "user" DROP COLUMN idp_subject;
  `);
};
