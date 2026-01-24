import React from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';
import type { City } from '../types';

interface DistanceMapProps {
  homeCity: City;
  guessCity: City;
  otherCity: City;
  correctCity: City;
}

const DistanceMap: React.FC<DistanceMapProps> = ({
  homeCity,
  guessCity,
  otherCity,
  correctCity
}) => {
  const getNormalizer = (firstCity: City, secondCity: City) => {
    const delta = firstCity.longitude - secondCity.longitude;

    if (delta > 180) {
      return 360;
    }

    if (delta < -180) {
      return -360;
    }
      
    return 0;
  };

  const normalizedLongitudes = {
    guessCity: guessCity.longitude + getNormalizer(homeCity, guessCity),
    otherCity: otherCity.longitude + getNormalizer(homeCity, otherCity),
  }

  const bounds = [
    [homeCity.latitude, homeCity.longitude],
    [guessCity.latitude, normalizedLongitudes.guessCity],
    [otherCity.latitude, normalizedLongitudes.otherCity]
  ];

  return (
    <MapContainer
      bounds={bounds as [number, number][]}
      className="w-full h-[200px] md:h-[400px] rounded-lg shadow-md z-0"
      style={{ zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* Home City Marker */}
      <CircleMarker
        center={[homeCity.latitude, homeCity.longitude]}
        radius={8}
        fillColor="#ef4444"
        color="#fff"
        weight={2}
        fillOpacity={1}
      >
        <Popup>
          <b>{homeCity.name}</b><br />
          Город-база
        </Popup>
      </CircleMarker>

      {/* Guess City Marker */}
      <CircleMarker
        center={[guessCity.latitude, normalizedLongitudes.guessCity]}
        radius={8}
        fillColor={guessCity === correctCity ? "#22c55e" : "#64748b"}
        color="#fff"
        weight={2}
        fillOpacity={1}
      >
        <Popup>
          <b>{guessCity.name}</b>
        </Popup>
      </CircleMarker>

      {/* Other City Marker */}
      <CircleMarker
        center={[otherCity.latitude, normalizedLongitudes.otherCity]}
        radius={8}
        fillColor={otherCity === correctCity ? "#22c55e" : "#64748b"}
        color="#fff"
        weight={2}
        fillOpacity={1}
      >
        <Popup>
          <b>{otherCity.name}</b>
        </Popup>
      </CircleMarker>

      {/* Line to Guess City */}
      <Polyline
        positions={[
          [homeCity.latitude, homeCity.longitude],
          [guessCity.latitude, normalizedLongitudes.guessCity]
        ]}
        color={guessCity === correctCity ? "#22c55e" : "#ef4444"}
        weight={3}
        dashArray={guessCity === correctCity ? undefined : "5,10"}
      />

      {/* Line to Other City */}
      <Polyline
        positions={[
          [homeCity.latitude, homeCity.longitude],
          [otherCity.latitude, normalizedLongitudes.otherCity]
        ]}
        color={guessCity === correctCity ? "#22c55e" : "#ef4444"}
        weight={3}
        dashArray="5,10"
      />
    </MapContainer>
  );
};

export default DistanceMap;