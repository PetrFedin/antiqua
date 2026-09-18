-- ANTIQUA v0.16 database integrity hardening.
-- This migration deliberately fails if pre-existing rows violate the new authority.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='listings_object_fk') THEN
    ALTER TABLE listings ADD CONSTRAINT listings_object_fk FOREIGN KEY(object_id) REFERENCES objects(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='auctions_object_fk') THEN
    ALTER TABLE auctions ADD CONSTRAINT auctions_object_fk FOREIGN KEY(object_id) REFERENCES objects(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='offers_listing_fk') THEN
    ALTER TABLE offers ADD CONSTRAINT offers_listing_fk FOREIGN KEY(listing_id) REFERENCES listings(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orders_listing_fk') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_listing_fk FOREIGN KEY(listing_id) REFERENCES listings(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orders_object_fk') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_object_fk FOREIGN KEY(object_id) REFERENCES objects(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='conversations_object_fk') THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_object_fk FOREIGN KEY(object_id) REFERENCES objects(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='conversations_listing_fk') THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_listing_fk FOREIGN KEY(listing_id) REFERENCES listings(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='collection_records_object_fk') THEN
    ALTER TABLE collection_records ADD CONSTRAINT collection_records_object_fk FOREIGN KEY(object_id) REFERENCES objects(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='auction_settlements_auction_fk') THEN
    ALTER TABLE auction_settlements ADD CONSTRAINT auction_settlements_auction_fk FOREIGN KEY(auction_id) REFERENCES auctions(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='auction_settlements_object_fk') THEN
    ALTER TABLE auction_settlements ADD CONSTRAINT auction_settlements_object_fk FOREIGN KEY(object_id) REFERENCES objects(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='shipments_order_fk') THEN
    ALTER TABLE shipments ADD CONSTRAINT shipments_order_fk FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='shipments_settlement_fk') THEN
    ALTER TABLE shipments ADD CONSTRAINT shipments_settlement_fk FOREIGN KEY(settlement_id) REFERENCES auction_settlements(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='shipments_object_fk') THEN
    ALTER TABLE shipments ADD CONSTRAINT shipments_object_fk FOREIGN KEY(object_id) REFERENCES objects(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='disputes_order_fk') THEN
    ALTER TABLE disputes ADD CONSTRAINT disputes_order_fk FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='disputes_settlement_fk') THEN
    ALTER TABLE disputes ADD CONSTRAINT disputes_settlement_fk FOREIGN KEY(settlement_id) REFERENCES auction_settlements(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='disputes_shipment_fk') THEN
    ALTER TABLE disputes ADD CONSTRAINT disputes_shipment_fk FOREIGN KEY(shipment_id) REFERENCES shipments(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='disputes_object_fk') THEN
    ALTER TABLE disputes ADD CONSTRAINT disputes_object_fk FOREIGN KEY(object_id) REFERENCES objects(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='insurance_document_media_fk') THEN
    ALTER TABLE insurance_policies ADD CONSTRAINT insurance_document_media_fk FOREIGN KEY(document_media_id) REFERENCES media_assets(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

ALTER TABLE listings VALIDATE CONSTRAINT listings_object_fk;
ALTER TABLE auctions VALIDATE CONSTRAINT auctions_object_fk;
ALTER TABLE offers VALIDATE CONSTRAINT offers_listing_fk;
ALTER TABLE orders VALIDATE CONSTRAINT orders_listing_fk;
ALTER TABLE orders VALIDATE CONSTRAINT orders_object_fk;
ALTER TABLE conversations VALIDATE CONSTRAINT conversations_object_fk;
ALTER TABLE conversations VALIDATE CONSTRAINT conversations_listing_fk;
ALTER TABLE collection_records VALIDATE CONSTRAINT collection_records_object_fk;
ALTER TABLE auction_settlements VALIDATE CONSTRAINT auction_settlements_auction_fk;
ALTER TABLE auction_settlements VALIDATE CONSTRAINT auction_settlements_object_fk;
ALTER TABLE shipments VALIDATE CONSTRAINT shipments_order_fk;
ALTER TABLE shipments VALIDATE CONSTRAINT shipments_settlement_fk;
ALTER TABLE shipments VALIDATE CONSTRAINT shipments_object_fk;
ALTER TABLE disputes VALIDATE CONSTRAINT disputes_order_fk;
ALTER TABLE disputes VALIDATE CONSTRAINT disputes_settlement_fk;
ALTER TABLE disputes VALIDATE CONSTRAINT disputes_shipment_fk;
ALTER TABLE disputes VALIDATE CONSTRAINT disputes_object_fk;
ALTER TABLE insurance_policies VALIDATE CONSTRAINT insurance_document_media_fk;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='shipments_exactly_one_source_ck') THEN
    ALTER TABLE shipments ADD CONSTRAINT shipments_exactly_one_source_ck CHECK(num_nonnulls(order_id,settlement_id)=1) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='exhibition_items_exactly_one_target_ck') THEN
    ALTER TABLE exhibition_items ADD CONSTRAINT exhibition_items_exactly_one_target_ck CHECK(num_nonnulls(object_id,ensemble_id)=1) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='auction_bids_amount_ck') THEN
    ALTER TABLE auction_bids ADD CONSTRAINT auction_bids_amount_ck CHECK(max_amount>0 AND visible_amount>0 AND visible_amount<=max_amount) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='auctions_amounts_ck') THEN
    ALTER TABLE auctions ADD CONSTRAINT auctions_amounts_ck CHECK(
      current_bid>=0 AND
      (baseline_bid IS NULL OR baseline_bid>=0) AND
      (reserve_price IS NULL OR reserve_price>=0) AND
      (increment IS NULL OR increment>0) AND
      bid_count>=0 AND version>=0 AND extension_window_seconds>=0 AND extension_seconds>=0 AND extension_count>=0 AND
      (starts_at IS NULL OR ends_at>starts_at)
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='auction_settlements_money_ck') THEN
    ALTER TABLE auction_settlements ADD CONSTRAINT auction_settlements_money_ck CHECK(winning_amount_minor>0 AND currency ~ '^[A-Z]{3}$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='payment_intents_money_ck') THEN
    ALTER TABLE payment_intents ADD CONSTRAINT payment_intents_money_ck CHECK(amount_minor>0 AND btrim(currency::text) ~ '^[A-Z]{3}$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='payouts_money_ck') THEN
    ALTER TABLE payouts ADD CONSTRAINT payouts_money_ck CHECK(amount_minor>0 AND btrim(currency::text) ~ '^[A-Z]{3}$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ledger_accounts_currency_ck') THEN
    ALTER TABLE ledger_accounts ADD CONSTRAINT ledger_accounts_currency_ck CHECK(btrim(currency::text) ~ '^[A-Z]{3}$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='insurance_value_currency_ck') THEN
    ALTER TABLE insurance_policies ADD CONSTRAINT insurance_value_currency_ck CHECK(
      (insured_value_minor IS NULL OR insured_value_minor>=0) AND
      (currency IS NULL OR currency ~ '^[A-Z]{3}$')
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='shipments_value_currency_ck') THEN
    ALTER TABLE shipments ADD CONSTRAINT shipments_value_currency_ck CHECK(
      (insured_value_minor IS NULL OR insured_value_minor>=0) AND
      (currency IS NULL OR currency ~ '^[A-Z]{3}$')
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='media_assets_integrity_ck') THEN
    ALTER TABLE media_assets ADD CONSTRAINT media_assets_integrity_ck CHECK(
      status IN('UPLOADING','VERIFYING','READY','REJECTED') AND
      (bytes IS NULL OR bytes>0) AND
      (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$')
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='outbox_attempts_ck') THEN
    ALTER TABLE outbox_events ADD CONSTRAINT outbox_attempts_ck CHECK(attempt_count>=0 AND attempt_count<=max_attempts) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='provider_events_attempts_ck') THEN
    ALTER TABLE provider_events ADD CONSTRAINT provider_events_attempts_ck CHECK(attempt_count>=0) NOT VALID;
  END IF;
END $$;

ALTER TABLE shipments VALIDATE CONSTRAINT shipments_exactly_one_source_ck;
ALTER TABLE exhibition_items VALIDATE CONSTRAINT exhibition_items_exactly_one_target_ck;
ALTER TABLE auction_bids VALIDATE CONSTRAINT auction_bids_amount_ck;
ALTER TABLE auctions VALIDATE CONSTRAINT auctions_amounts_ck;
ALTER TABLE auction_settlements VALIDATE CONSTRAINT auction_settlements_money_ck;
ALTER TABLE payment_intents VALIDATE CONSTRAINT payment_intents_money_ck;
ALTER TABLE payouts VALIDATE CONSTRAINT payouts_money_ck;
ALTER TABLE ledger_accounts VALIDATE CONSTRAINT ledger_accounts_currency_ck;
ALTER TABLE insurance_policies VALIDATE CONSTRAINT insurance_value_currency_ck;
ALTER TABLE shipments VALIDATE CONSTRAINT shipments_value_currency_ck;
ALTER TABLE media_assets VALIDATE CONSTRAINT media_assets_integrity_ck;
ALTER TABLE outbox_events VALIDATE CONSTRAINT outbox_attempts_ck;
ALTER TABLE provider_events VALIDATE CONSTRAINT provider_events_attempts_ck;

CREATE OR REPLACE FUNCTION antiqua_validate_listing_actor_links()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE li listings%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='offers' THEN
    SELECT * INTO li FROM listings WHERE id=NEW.listing_id;
    IF NOT FOUND THEN RETURN NEW; END IF;
    IF NEW.seller_id IS DISTINCT FROM li.seller_id THEN
      RAISE EXCEPTION 'Offer seller does not own listing' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='orders' AND NEW.listing_id IS NOT NULL THEN
    SELECT * INTO li FROM listings WHERE id=NEW.listing_id;
    IF NOT FOUND THEN RETURN NEW; END IF;
    IF NEW.object_id IS DISTINCT FROM li.object_id OR NEW.seller_id IS DISTINCT FROM li.seller_id THEN
      RAISE EXCEPTION 'Order does not match listing object/seller' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='conversations' AND NEW.listing_id IS NOT NULL THEN
    SELECT * INTO li FROM listings WHERE id=NEW.listing_id;
    IF NOT FOUND THEN RETURN NEW; END IF;
    IF NEW.object_id IS DISTINCT FROM li.object_id OR NEW.seller_id IS DISTINCT FROM li.seller_id THEN
      RAISE EXCEPTION 'Conversation does not match listing object/seller' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS offers_listing_consistency_trg ON offers;
CREATE TRIGGER offers_listing_consistency_trg BEFORE INSERT OR UPDATE OF listing_id,seller_id ON offers
FOR EACH ROW EXECUTE FUNCTION antiqua_validate_listing_actor_links();

DROP TRIGGER IF EXISTS orders_listing_consistency_trg ON orders;
CREATE TRIGGER orders_listing_consistency_trg BEFORE INSERT OR UPDATE OF listing_id,object_id,seller_id ON orders
FOR EACH ROW EXECUTE FUNCTION antiqua_validate_listing_actor_links();

DROP TRIGGER IF EXISTS conversations_listing_consistency_trg ON conversations;
CREATE TRIGGER conversations_listing_consistency_trg BEFORE INSERT OR UPDATE OF listing_id,object_id,seller_id ON conversations
FOR EACH ROW EXECUTE FUNCTION antiqua_validate_listing_actor_links();

CREATE OR REPLACE FUNCTION antiqua_validate_settlement_source()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a_object text;
BEGIN
  SELECT object_id INTO a_object FROM auctions WHERE id=NEW.auction_id;
  IF a_object IS DISTINCT FROM NEW.object_id THEN
    RAISE EXCEPTION 'Settlement object does not match auction object' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS auction_settlements_source_consistency_trg ON auction_settlements;
CREATE TRIGGER auction_settlements_source_consistency_trg BEFORE INSERT OR UPDATE OF auction_id,object_id ON auction_settlements
FOR EACH ROW EXECUTE FUNCTION antiqua_validate_settlement_source();

CREATE OR REPLACE FUNCTION antiqua_validate_shipment_source()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE src_object text; src_buyer text; src_seller text;
BEGIN
  IF num_nonnulls(NEW.order_id,NEW.settlement_id)<>1 THEN RETURN NEW; END IF;
  IF NEW.order_id IS NOT NULL THEN
    SELECT object_id,buyer_account_id,seller_id INTO src_object,src_buyer,src_seller FROM orders WHERE id=NEW.order_id;
  ELSE
    SELECT object_id,buyer_account_id,seller_id INTO src_object,src_buyer,src_seller FROM auction_settlements WHERE id=NEW.settlement_id;
  END IF;
  IF src_object IS DISTINCT FROM NEW.object_id OR src_buyer IS DISTINCT FROM NEW.buyer_account_id OR src_seller IS DISTINCT FROM NEW.seller_id THEN
    RAISE EXCEPTION 'Shipment does not match source object/buyer/seller' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS shipments_source_consistency_trg ON shipments;
CREATE TRIGGER shipments_source_consistency_trg BEFORE INSERT OR UPDATE OF order_id,settlement_id,object_id,buyer_account_id,seller_id ON shipments
FOR EACH ROW EXECUTE FUNCTION antiqua_validate_shipment_source();

CREATE OR REPLACE FUNCTION antiqua_validate_exhibition_section()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.section_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM exhibition_sections s WHERE s.id=NEW.section_id AND s.exhibition_id=NEW.exhibition_id
  ) THEN
    RAISE EXCEPTION 'Exhibition item section belongs to another exhibition' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS exhibition_items_section_consistency_trg ON exhibition_items;
CREATE TRIGGER exhibition_items_section_consistency_trg BEFORE INSERT OR UPDATE OF exhibition_id,section_id ON exhibition_items
FOR EACH ROW EXECUTE FUNCTION antiqua_validate_exhibition_section();

CREATE OR REPLACE FUNCTION antiqua_validate_ensemble_claim()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slot_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM ensemble_slots s WHERE s.id=NEW.slot_id AND s.ensemble_id=NEW.ensemble_id
  ) THEN
    RAISE EXCEPTION 'Ensemble claim slot belongs to another ensemble' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ensemble_claims_slot_consistency_trg ON ensemble_claims;
CREATE TRIGGER ensemble_claims_slot_consistency_trg BEFORE INSERT OR UPDATE OF ensemble_id,slot_id ON ensemble_claims
FOR EACH ROW EXECUTE FUNCTION antiqua_validate_ensemble_claim();

CREATE OR REPLACE FUNCTION antiqua_validate_wanted_slot()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slot_id IS NOT NULL THEN
    IF NEW.ensemble_id IS NULL OR NOT EXISTS(
      SELECT 1 FROM ensemble_slots s WHERE s.id=NEW.slot_id AND s.ensemble_id=NEW.ensemble_id
    ) THEN
      RAISE EXCEPTION 'Wanted request slot must belong to its ensemble' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS wanted_requests_slot_consistency_trg ON wanted_requests;
CREATE TRIGGER wanted_requests_slot_consistency_trg BEFORE INSERT OR UPDATE OF ensemble_id,slot_id ON wanted_requests
FOR EACH ROW EXECUTE FUNCTION antiqua_validate_wanted_slot();

CREATE OR REPLACE FUNCTION antiqua_validate_media_parent()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.entity_type='OBJECT' THEN
    IF NOT EXISTS(SELECT 1 FROM objects WHERE id=NEW.entity_id) THEN
      RAISE EXCEPTION 'Media OBJECT parent does not exist' USING ERRCODE='23503';
    END IF;
  ELSIF NEW.entity_type='DRAFT' THEN
    IF NOT EXISTS(SELECT 1 FROM seller_drafts WHERE id=NEW.entity_id) THEN
      RAISE EXCEPTION 'Media DRAFT parent does not exist' USING ERRCODE='23503';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported media parent type' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS media_assets_parent_consistency_trg ON media_assets;
CREATE TRIGGER media_assets_parent_consistency_trg BEFORE INSERT OR UPDATE OF entity_type,entity_id ON media_assets
FOR EACH ROW EXECUTE FUNCTION antiqua_validate_media_parent();

CREATE OR REPLACE FUNCTION antiqua_restrict_media_parent_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='objects' AND EXISTS(SELECT 1 FROM media_assets WHERE entity_type='OBJECT' AND entity_id=OLD.id) THEN
    RAISE EXCEPTION 'Object has media assets' USING ERRCODE='23503';
  END IF;
  IF TG_TABLE_NAME='seller_drafts' AND EXISTS(SELECT 1 FROM media_assets WHERE entity_type='DRAFT' AND entity_id=OLD.id) THEN
    RAISE EXCEPTION 'Draft has media assets' USING ERRCODE='23503';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS objects_media_delete_restrict_trg ON objects;
CREATE TRIGGER objects_media_delete_restrict_trg BEFORE DELETE ON objects
FOR EACH ROW EXECUTE FUNCTION antiqua_restrict_media_parent_delete();

DROP TRIGGER IF EXISTS drafts_media_delete_restrict_trg ON seller_drafts;
CREATE TRIGGER drafts_media_delete_restrict_trg BEFORE DELETE ON seller_drafts
FOR EACH ROW EXECUTE FUNCTION antiqua_restrict_media_parent_delete();

-- Fail visibly if legacy rows already violate cross-aggregate rules.
DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM offers x JOIN listings l ON l.id=x.listing_id WHERE x.seller_id IS DISTINCT FROM l.seller_id
  ) THEN RAISE EXCEPTION 'Existing offer/listing seller mismatch'; END IF;

  IF EXISTS(
    SELECT 1 FROM orders x JOIN listings l ON l.id=x.listing_id
    WHERE x.listing_id IS NOT NULL AND (x.object_id IS DISTINCT FROM l.object_id OR x.seller_id IS DISTINCT FROM l.seller_id)
  ) THEN RAISE EXCEPTION 'Existing order/listing mismatch'; END IF;

  IF EXISTS(
    SELECT 1 FROM conversations x JOIN listings l ON l.id=x.listing_id
    WHERE x.listing_id IS NOT NULL AND (x.object_id IS DISTINCT FROM l.object_id OR x.seller_id IS DISTINCT FROM l.seller_id)
  ) THEN RAISE EXCEPTION 'Existing conversation/listing mismatch'; END IF;

  IF EXISTS(
    SELECT 1 FROM auction_settlements s JOIN auctions a ON a.id=s.auction_id WHERE s.object_id IS DISTINCT FROM a.object_id
  ) THEN RAISE EXCEPTION 'Existing settlement/auction mismatch'; END IF;

  IF EXISTS(
    SELECT 1 FROM shipments s
    LEFT JOIN orders o ON o.id=s.order_id
    LEFT JOIN auction_settlements st ON st.id=s.settlement_id
    WHERE (s.order_id IS NOT NULL AND (s.object_id IS DISTINCT FROM o.object_id OR s.buyer_account_id IS DISTINCT FROM o.buyer_account_id OR s.seller_id IS DISTINCT FROM o.seller_id))
       OR (s.settlement_id IS NOT NULL AND (s.object_id IS DISTINCT FROM st.object_id OR s.buyer_account_id IS DISTINCT FROM st.buyer_account_id OR s.seller_id IS DISTINCT FROM st.seller_id))
  ) THEN RAISE EXCEPTION 'Existing shipment/source mismatch'; END IF;

  IF EXISTS(
    SELECT 1 FROM exhibition_items i JOIN exhibition_sections s ON s.id=i.section_id
    WHERE i.section_id IS NOT NULL AND i.exhibition_id<>s.exhibition_id
  ) THEN RAISE EXCEPTION 'Existing exhibition item/section mismatch'; END IF;

  IF EXISTS(
    SELECT 1 FROM ensemble_claims c JOIN ensemble_slots s ON s.id=c.slot_id
    WHERE c.slot_id IS NOT NULL AND c.ensemble_id<>s.ensemble_id
  ) THEN RAISE EXCEPTION 'Existing ensemble claim/slot mismatch'; END IF;

  IF EXISTS(
    SELECT 1 FROM wanted_requests w JOIN ensemble_slots s ON s.id=w.slot_id
    WHERE w.slot_id IS NOT NULL AND (w.ensemble_id IS NULL OR w.ensemble_id<>s.ensemble_id)
  ) THEN RAISE EXCEPTION 'Existing wanted request/slot mismatch'; END IF;

  IF EXISTS(
    SELECT 1 FROM media_assets m
    WHERE (m.entity_type='OBJECT' AND NOT EXISTS(SELECT 1 FROM objects o WHERE o.id=m.entity_id))
       OR (m.entity_type='DRAFT' AND NOT EXISTS(SELECT 1 FROM seller_drafts d WHERE d.id=m.entity_id))
  ) THEN RAISE EXCEPTION 'Existing orphan media asset'; END IF;
END $$;

CREATE INDEX IF NOT EXISTS listings_object_integrity_idx ON listings(object_id);
CREATE INDEX IF NOT EXISTS auctions_object_integrity_idx ON auctions(object_id);
CREATE INDEX IF NOT EXISTS orders_object_integrity_idx ON orders(object_id);
CREATE INDEX IF NOT EXISTS shipments_object_integrity_idx ON shipments(object_id);
CREATE INDEX IF NOT EXISTS disputes_object_integrity_idx ON disputes(object_id);
