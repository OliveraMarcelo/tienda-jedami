export const UPDATE_BRANDING = `
  UPDATE branding
  SET store_name      = COALESCE($1, store_name),
      primary_color   = COALESCE($2, primary_color),
      secondary_color = COALESCE($3, secondary_color),
      logo_url        = $4,
      updated_at      = NOW()
  WHERE id = 1
  RETURNING store_name, primary_color, secondary_color, logo_url,
            bank_transfer_cvu, bank_transfer_alias, bank_transfer_holder_name,
            bank_transfer_bank_name, bank_transfer_notes
`;
// $4 = logoUrl — sin COALESCE para permitir borrar el logo pasando null
