export const FIND_BRANDING = `
  SELECT store_name, primary_color, secondary_color, logo_url,
         bank_transfer_cvu, bank_transfer_alias, bank_transfer_holder_name,
         bank_transfer_bank_name, bank_transfer_notes, whatsapp_number,
         location_name, location_stall, location_aisle, location_maps_url
  FROM branding
  WHERE id = 1
`;
