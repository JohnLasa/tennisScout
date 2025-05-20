import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Container, Button, Table, Row, Col, Alert } from 'react-bootstrap';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';

const SummaryScreen = () => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      collection(db, 'matches'),
      (snapshot) => {
        const matchesList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMatches(matchesList);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching matches:', error);
        setError('Error loading matches. Please try again.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Memoize the matches table
  const matchesTable = useMemo(() => (
    <Table striped bordered hover responsive>
      <thead>
        <tr>
          <th>Court</th>
          <th>Teams</th>
          <th>Score</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {matches.map(match => (
          <tr key={match.id}>
            <td>{match.court}</td>
            <td>
              {match.team1.name} vs {match.team2.name}
            </td>
            <td>
              {match.score.team1.sets}-{match.score.team2.sets} | 
              {match.score.team1.games}-{match.score.team2.games}
            </td>
            <td>
              <Button
                variant="primary"
                size="sm"
                className="me-2"
                onClick={() => navigate('/match', { state: { matchId: match.id } })}
              >
                View Match
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  ), [matches, navigate]);

  if (loading) {
    return (
      <Container className="py-4">
        <Card>
          <Card.Body className="text-center">
            <h2>Loading Matches...</h2>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-4">
        <Card>
          <Card.Body className="text-center">
            <h2>Error</h2>
            <p className="text-danger">{error}</p>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  const getAllPoints = () => {
    return matches.flatMap(match => 
      match.points.map(point => ({
        ...point,
        court: match.court,
        team1: match.team1,
        team2: match.team2
      }))
    );
  };

  const calculateServeStats = (points) => {
    const stats = {
      deuce: {
        'body-bh': { total: 0, aces: 0, serviceWinners: 0, returnErrors: 0 },
        'body-fh': { total: 0, aces: 0, serviceWinners: 0, returnErrors: 0 },
        'wide': { total: 0, aces: 0, serviceWinners: 0, returnErrors: 0 },
        't': { total: 0, aces: 0, serviceWinners: 0, returnErrors: 0 }
      },
      ad: {
        'body-bh': { total: 0, aces: 0, serviceWinners: 0, returnErrors: 0 },
        'body-fh': { total: 0, aces: 0, serviceWinners: 0, returnErrors: 0 },
        'wide': { total: 0, aces: 0, serviceWinners: 0, returnErrors: 0 },
        't': { total: 0, aces: 0, serviceWinners: 0, returnErrors: 0 }
      }
    };

    points.forEach(point => {
      if (!point.serveDirection) return;

      const [court, location] = point.serveDirection.split('-');
      if (!court || !location) return;

      if (!stats[court] || !stats[court][location]) return;

      stats[court][location].total++;
      
      if (point.result === 'ace') {
        stats[court][location].aces++;
      } else if (point.result === 'return-error') {
        stats[court][location].returnErrors++;
      }
    });

    return stats;
  };

  const calculateFormationStats = (points) => {
    const stats = {
      regular: { total: 0, won: 0 },
      'mini-i': { total: 0, won: 0 },
      'i-formation': { total: 0, won: 0 }
    };

    points.forEach(point => {
      if (!point.formation) return;
      if (!stats[point.formation]) return;

      stats[point.formation].total++;
      if (point.result && point.result !== 'return-error') {
        stats[point.formation].won++;
      }
    });

    return stats;
  };

  const calculateTacticStats = (points) => {
    const stats = {
      'serve-volley': { total: 0, won: 0 },
      'stay-back': { total: 0, won: 0 },
      'poach': { total: 0, won: 0 },
      'fake-poach': { total: 0, won: 0 }
    };

    points.forEach(point => {
      if (!point.tactic) return;
      if (!stats[point.tactic]) return;

      stats[point.tactic].total++;
      if (point.result && point.result !== 'return-error') {
        stats[point.tactic].won++;
      }
    });

    return stats;
  };

  const calculateResultStats = (points) => {
    const stats = {
      ace: { total: 0 },
      'return-winner': { total: 0 },
      'return-error': { total: 0 },
      poach: { total: 0 },
      rally: { total: 0 }
    };

    points.forEach(point => {
      if (!point.result) return;
      if (!stats[point.result]) return;

      stats[point.result].total++;
    });

    return stats;
  };

  const calculateBigPointStats = (points) => {
    const stats = {
      total: 0,
      won: 0,
      byType: {
        'break-point': { total: 0, won: 0 },
        'set-point': { total: 0, won: 0 },
        'match-point': { total: 0, won: 0 },
        'manual': { total: 0, won: 0 }
      },
      byFormation: {
        regular: { total: 0, won: 0 },
        'mini-i': { total: 0, won: 0 },
        'i-formation': { total: 0, won: 0 }
      },
      byTactic: {
        'serve-volley': { total: 0, won: 0 },
        'stay-back': { total: 0, won: 0 },
        'poach': { total: 0, won: 0 },
        'fake-poach': { total: 0, won: 0 }
      },
      byServeDirection: {
        deuce: {
          'body-bh': { total: 0, won: 0 },
          'body-fh': { total: 0, won: 0 },
          'wide': { total: 0, won: 0 },
          't': { total: 0, won: 0 }
        },
        ad: {
          'body-bh': { total: 0, won: 0 },
          'body-fh': { total: 0, won: 0 },
          'wide': { total: 0, won: 0 },
          't': { total: 0, won: 0 }
        }
      }
    };

    points.forEach(point => {
      if (!point.isBigPoint) return;

      stats.total++;
      if (point.result && point.result !== 'return-error') {
        stats.won++;
      }

      // Track by type
      if (point.bigPointType && stats.byType[point.bigPointType]) {
        stats.byType[point.bigPointType].total++;
        if (point.result && point.result !== 'return-error') {
          stats.byType[point.bigPointType].won++;
        }
      }

      // Track by formation
      if (point.formation && stats.byFormation[point.formation]) {
        stats.byFormation[point.formation].total++;
        if (point.result && point.result !== 'return-error') {
          stats.byFormation[point.formation].won++;
        }
      }

      // Track by tactic
      if (point.tactic && stats.byTactic[point.tactic]) {
        stats.byTactic[point.tactic].total++;
        if (point.result && point.result !== 'return-error') {
          stats.byTactic[point.tactic].won++;
        }
      }

      // Track by serve direction
      if (point.serveDirection) {
        const [court, location] = point.serveDirection.split('-');
        if (court && location && stats.byServeDirection[court] && stats.byServeDirection[court][location]) {
          stats.byServeDirection[court][location].total++;
          if (point.result && point.result !== 'return-error') {
            stats.byServeDirection[court][location].won++;
          }
        }
      }
    });

    return stats;
  };

  const getSuccessRate = (won, total) => {
    if (total === 0) return '0%';
    return `${Math.round((won / total) * 100)}%`;
  };

  const getServeSuccessRate = (stats) => {
    if (stats.total === 0) return '0%';
    const successfulServes = stats.aces + stats.returnErrors;
    return `${Math.round((successfulServes / stats.total) * 100)}%`;
  };

  const renderOverallStats = () => {
    const allPoints = getAllPoints();
    return (
      <div>
        <h4>Overall Statistics</h4>
        <p className="mb-3">
          Total Matches: {matches.length} | Total Points: {allPoints.length}
        </p>
        {renderServeStats()}
        {renderFormationStats()}
        {renderTacticStats()}
        {renderResultStats()}
        {renderBigPointStats()}
      </div>
    );
  };

  const renderServeStats = () => {
    const serveStats = calculateServeStats(getAllPoints());
    const courts = ['deuce', 'ad'];
    const locations = ['body-bh', 'body-fh', 'wide', 't'];

    return (
      <div>
        <h4>Serve Direction Analysis</h4>
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>Court</th>
              <th>Location</th>
              <th>Total Serves</th>
              <th>Aces</th>
              <th>Return Errors</th>
              <th>Success Rate</th>
            </tr>
          </thead>
          <tbody>
            {courts.map(court => (
              locations.map(location => {
                const stats = serveStats[court][location];
                return (
                  <tr key={`${court}-${location}`}>
                    <td>{court.toUpperCase()}</td>
                    <td>{location.toUpperCase()}</td>
                    <td>{stats.total}</td>
                    <td>{stats.aces}</td>
                    <td>{stats.returnErrors}</td>
                    <td>{getServeSuccessRate(stats)}</td>
                  </tr>
                );
              })
            ))}
          </tbody>
        </Table>
      </div>
    );
  };

  const renderFormationStats = () => {
    const formationStats = calculateFormationStats(getAllPoints());
    const formations = ['regular', 'mini-i', 'i-formation'];

    return (
      <div>
        <h4>Formation Analysis</h4>
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>Formation</th>
              <th>Total Points</th>
              <th>Points Won</th>
              <th>Success Rate</th>
            </tr>
          </thead>
          <tbody>
            {formations.map(formation => {
              const stats = formationStats[formation];
              return (
                <tr key={formation}>
                  <td>{formation.toUpperCase()}</td>
                  <td>{stats.total}</td>
                  <td>{stats.won}</td>
                  <td>{getSuccessRate(stats.won, stats.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    );
  };

  const renderTacticStats = () => {
    const tacticStats = calculateTacticStats(getAllPoints());
    const tactics = ['serve-volley', 'stay-back', 'poach', 'fake-poach'];

    return (
      <div>
        <h4>Tactic Analysis</h4>
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>Tactic</th>
              <th>Total Points</th>
              <th>Points Won</th>
              <th>Success Rate</th>
            </tr>
          </thead>
          <tbody>
            {tactics.map(tactic => {
              const stats = tacticStats[tactic];
              return (
                <tr key={tactic}>
                  <td>{tactic.toUpperCase()}</td>
                  <td>{stats.total}</td>
                  <td>{stats.won}</td>
                  <td>{getSuccessRate(stats.won, stats.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    );
  };

  const renderResultStats = () => {
    const resultStats = calculateResultStats(getAllPoints());
    const results = ['ace', 'return-winner', 'return-error', 'poach', 'rally'];

    return (
      <div>
        <h4>Point Outcome Analysis</h4>
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>Outcome</th>
              <th>Count</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            {results.map(result => {
              const stats = resultStats[result];
              const total = getAllPoints().length;
              return (
                <tr key={result}>
                  <td>{result.toUpperCase()}</td>
                  <td>{stats.total}</td>
                  <td>{total > 0 ? `${Math.round((stats.total / total) * 100)}%` : '0%'}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    );
  };

  const renderBigPointStats = () => {
    const bigPointStats = calculateBigPointStats(getAllPoints());
    if (bigPointStats.total === 0) return null;

    return (
      <div>
        <h4>Big Point Analysis</h4>
        <Alert variant="warning" className="mb-3">
          <h5>Overall Big Point Performance</h5>
          <p className="mb-0">
            Won {bigPointStats.won} out of {bigPointStats.total} big points ({getSuccessRate(bigPointStats.won, bigPointStats.total)})
          </p>
        </Alert>

        <h5>By Point Type</h5>
        <Table striped bordered hover className="mb-4">
          <thead>
            <tr>
              <th>Type</th>
              <th>Total Points</th>
              <th>Points Won</th>
              <th>Success Rate</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(bigPointStats.byType).map(([type, stats]) => (
              stats.total > 0 && (
                <tr key={type}>
                  <td>{type.replace('-', ' ').toUpperCase()}</td>
                  <td>{stats.total}</td>
                  <td>{stats.won}</td>
                  <td>{getSuccessRate(stats.won, stats.total)}</td>
                </tr>
              )
            ))}
          </tbody>
        </Table>

        <h5>By Formation</h5>
        <Table striped bordered hover className="mb-4">
          <thead>
            <tr>
              <th>Formation</th>
              <th>Total Points</th>
              <th>Points Won</th>
              <th>Success Rate</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(bigPointStats.byFormation).map(([formation, stats]) => (
              stats.total > 0 && (
                <tr key={formation}>
                  <td>{formation.toUpperCase()}</td>
                  <td>{stats.total}</td>
                  <td>{stats.won}</td>
                  <td>{getSuccessRate(stats.won, stats.total)}</td>
                </tr>
              )
            ))}
          </tbody>
        </Table>

        <h5>By Tactic</h5>
        <Table striped bordered hover className="mb-4">
          <thead>
            <tr>
              <th>Tactic</th>
              <th>Total Points</th>
              <th>Points Won</th>
              <th>Success Rate</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(bigPointStats.byTactic).map(([tactic, stats]) => (
              stats.total > 0 && (
                <tr key={tactic}>
                  <td>{tactic.toUpperCase()}</td>
                  <td>{stats.total}</td>
                  <td>{stats.won}</td>
                  <td>{getSuccessRate(stats.won, stats.total)}</td>
                </tr>
              )
            ))}
          </tbody>
        </Table>

        <h5>By Serve Direction</h5>
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>Court</th>
              <th>Location</th>
              <th>Total Points</th>
              <th>Points Won</th>
              <th>Success Rate</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(bigPointStats.byServeDirection).map(([court, locations]) => (
              Object.entries(locations).map(([location, stats]) => (
                stats.total > 0 && (
                  <tr key={`${court}-${location}`}>
                    <td>{court.toUpperCase()}</td>
                    <td>{location.toUpperCase()}</td>
                    <td>{stats.total}</td>
                    <td>{stats.won}</td>
                    <td>{getSuccessRate(stats.won, stats.total)}</td>
                  </tr>
                )
              ))
            ))}
          </tbody>
        </Table>
      </div>
    );
  };

  return (
    <Container className="py-4">
      <Card>
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>Match Summary</h2>
            <Button variant="primary" onClick={() => navigate('/')}>
              Back to Match Selection
            </Button>
          </div>

          {matchesTable}
          {renderOverallStats()}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default React.memo(SummaryScreen); 