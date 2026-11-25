import React, { useCallback, useEffect, useState } from 'react';
import type { BuildingDTO, RoomDTO } from '@campus/shared';
import { webApi } from '../api/client';

export function LocationsPage() {
  const [buildings, setBuildings] = useState<BuildingDTO[]>([]);
  const [rooms, setRooms] = useState<RoomDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [bName, setBName] = useState('');
  const [bCode, setBCode] = useState('');
  const [bDesc, setBDesc] = useState('');

  const [rBuildingId, setRBuildingId] = useState('');
  const [rName, setRName] = useState('');
  const [rNumber, setRNumber] = useState('');
  const [rFloor, setRFloor] = useState('1st Floor');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await webApi.listLocations(true);
      setBuildings(res.buildings);
      setRooms(res.rooms);
      if (!rBuildingId && res.buildings[0]) {
        setRBuildingId(res.buildings[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load locations.');
    } finally {
      setLoading(false);
    }
  }, [rBuildingId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAddBuilding(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await webApi.createBuilding({ name: bName, code: bCode, description: bDesc });
      setBName('');
      setBCode('');
      setBDesc('');
      setNotice('Building created.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create building.');
    }
  }

  async function handleAddRoom(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await webApi.createRoom({
        buildingId: rBuildingId,
        name: rName,
        roomNumber: rNumber,
        floor: rFloor,
      });
      setRName('');
      setRNumber('');
      setNotice('Room created.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room.');
    }
  }

  async function toggleBuildingActive(building: BuildingDTO) {
    setError(null);
    try {
      await webApi.updateBuilding(building.id, { active: !building.active });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update building.');
    }
  }

  async function toggleRoomActive(room: RoomDTO) {
    setError(null);
    try {
      await webApi.updateRoom(room.id, { active: !room.active });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update room.');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Buildings &amp; Rooms</h2>
          <p className="page-subtitle">
            Manage campus locations synced to field reporter mobile apps
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="photo-compare-grid" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3 className="card-title">Add Building</h3>
          <form onSubmit={handleAddBuilding} style={{ display: 'grid', gap: 10 }}>
            <div>
              <label className="field-label" htmlFor="b-name">
                Building Name
              </label>
              <input
                id="b-name"
                className="input"
                placeholder="e.g., Central Library"
                value={bName}
                onChange={(e) => setBName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="b-code">
                Code
              </label>
              <input
                id="b-code"
                className="input"
                placeholder="e.g., LIB"
                value={bCode}
                onChange={(e) => setBCode(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="b-desc">
                Description
              </label>
              <input
                id="b-desc"
                className="input"
                placeholder="Reading rooms and archive floors"
                value={bDesc}
                onChange={(e) => setBDesc(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Create Building
            </button>
          </form>
        </div>

        <div className="card">
          <h3 className="card-title">Add Room</h3>
          <form onSubmit={handleAddRoom} style={{ display: 'grid', gap: 10 }}>
            <div>
              <label className="field-label" htmlFor="r-building">
                Building
              </label>
              <select
                id="r-building"
                className="select"
                value={rBuildingId}
                onChange={(e) => setRBuildingId(e.target.value)}
                required
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label className="field-label" htmlFor="r-num">
                  Room Number
                </label>
                <input
                  id="r-num"
                  className="input"
                  placeholder="e.g., 208"
                  value={rNumber}
                  onChange={(e) => setRNumber(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="field-label" htmlFor="r-floor">
                  Floor
                </label>
                <input
                  id="r-floor"
                  className="input"
                  value={rFloor}
                  onChange={(e) => setRFloor(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="r-name">
                Room Name
              </label>
              <input
                id="r-name"
                className="input"
                placeholder="e.g., Seminar Room 208"
                value={rName}
                onChange={(e) => setRName(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={!rBuildingId}>
              Create Room
            </button>
          </form>
        </div>
      </div>

      {loading ? (
        <div className="card">Loading campus locations...</div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          <div className="card">
            <h3 className="card-title">Buildings ({buildings.length})</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {buildings.map((b) => (
                    <tr key={b.id}>
                      <td className="mono">{b.code}</td>
                      <td>{b.name}</td>
                      <td>{b.description || '—'}</td>
                      <td>
                        <span className={`badge ${b.active ? 'status-closed' : 'status-reopened'}`}>
                          {b.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => toggleBuildingActive(b)}
                        >
                          {b.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Rooms ({rooms.length})</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Building</th>
                    <th>Room #</th>
                    <th>Name</th>
                    <th>Floor</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((r) => (
                    <tr key={r.id}>
                      <td>{r.buildingName ?? r.buildingId}</td>
                      <td className="mono">{r.roomNumber}</td>
                      <td>{r.name}</td>
                      <td>{r.floor}</td>
                      <td>
                        <span className={`badge ${r.active ? 'status-closed' : 'status-reopened'}`}>
                          {r.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => toggleRoomActive(r)}
                        >
                          {r.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
