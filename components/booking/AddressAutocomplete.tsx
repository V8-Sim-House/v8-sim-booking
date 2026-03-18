"use client";
import { useEffect, useRef } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

interface ParsedAddress {
  address: string;
  city: string;
  state: string;
  zip: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect: (parsed: ParsedAddress) => void;
  placeholder?: string;
}

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function AddressAutocomplete({ value, onChange, onAddressSelect, placeholder }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!apiKey || !inputRef.current) return;

    setOptions({ key: apiKey, v: "weekly" });

    importLibrary("places").then(() => {
      if (!inputRef.current) return;

      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: "us" },
        fields: ["address_components"],
        types: ["address"],
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.address_components) return;

        let streetNumber = "";
        let streetName = "";
        let city = "";
        let state = "";
        let zip = "";

        for (const component of place.address_components) {
          const type = component.types[0];
          if (type === "street_number") streetNumber = component.long_name;
          if (type === "route") streetName = component.long_name;
          if (type === "locality") city = component.long_name;
          if (type === "administrative_area_level_1") state = component.short_name;
          if (type === "postal_code") zip = component.long_name;
        }

        const address = `${streetNumber} ${streetName}`.trim();
        onChange(address);
        onAddressSelect({ address, city, state, zip });
      });
    }).catch(() => {
      // Places API unavailable — plain input still works
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "123 Main St"}
      className="v8-input"
      autoComplete="off"
    />
  );
}
