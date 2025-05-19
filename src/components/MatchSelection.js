import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Button, Row, Col, Form } from 'react-bootstrap';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, onSnapshot } from 'firebase/firestore';

const MatchSelection = () => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [newMatch, setNewMatch] = useState({
    court: '',
    team1: { name: '', players: ['', ''] },
    team2: { name: '', players: ['', ''] }
  });

  useEffect(() => {
    // Subscribe to matches collection
    const unsubscribe = onSnapshot(collection(db, 'matches'), (snapshot) => {
      const matchesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMatches(matchesList);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const handleNewMatchChange = (field, value) => {
    if (field.includes('.')) {
      const [team, subfield] = field.split('.');
      setNewMatch(prev => ({
        ...prev,
        [team]: {
          ...prev[team],
          [subfield]: value
        }
      }));
    } else {
      setNewMatch(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handlePlayerChange = (team, index, value) => {
    setNewMatch(prev => ({
      ...prev,
      [team]: {
        ...prev[team],
        players: prev[team].players.map((player, i) => 
          i === index ? value : player
        )
      }
    }));
  };

  const handleCreateMatch = async () => {
    if (!newMatch.court || !newMatch.team1.name || !newMatch.team2.name) {
      alert('Please fill in all required fields');
      return;
    }

    const matchData = {
      court: newMatch.court,
      team1: newMatch.team1,
      team2: newMatch.team2,
      points: [],
      currentServer: 1,
      currentPoint: {
        servingTeam: 1,
        servingPlayer: 0,
        receivingTeam: 2,
        receivingPlayer: 0,
        serveDirection: '',
        formation: '',
        tactic: '',
        result: '',
        isBigPoint: false,
        bigPointType: '',
        rallyLength: 0,
        notes: ''
      },
      score: {
        team1: { sets: 0, games: 0, points: 0 },
        team2: { sets: 0, games: 0, points: 0 }
      },
      currentGame: {
        team1: 0,
        team2: 0
      },
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'matches'), matchData);
      setNewMatch({
        court: '',
        team1: { name: '', players: ['', ''] },
        team2: { name: '', players: ['', ''] }
      });
    } catch (error) {
      console.error('Error creating match:', error);
      alert('Error creating match. Please try again.');
    }
  };

  const handleDeleteMatch = async (matchId) => {
    if (window.confirm('Are you sure you want to delete this match?')) {
      try {
        await deleteDoc(doc(db, 'matches', matchId));
      } catch (error) {
        console.error('Error deleting match:', error);
        alert('Error deleting match. Please try again.');
      }
    }
  };

  const handleStartMatch = (matchId) => {
    localStorage.setItem('currentMatchId', matchId);
    navigate('/match', { state: { matchId } });
  };

  return (
    <Container className="py-4">
      <Card className="mb-4">
        <Card.Body>
          <h2 className="text-center mb-4">Tennis Scout - Match Selection</h2>

          <div className="mb-4">
            <h4>Create New Match</h4>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Court</Form.Label>
                  <Form.Control
                    type="text"
                    value={newMatch.court}
                    onChange={(e) => handleNewMatchChange('court', e.target.value)}
                    placeholder="Enter court number/name"
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Team 1 Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={newMatch.team1.name}
                    onChange={(e) => handleNewMatchChange('team1.name', e.target.value)}
                    placeholder="Enter team 1 name"
                  />
                  <Form.Control
                    type="text"
                    value={newMatch.team1.players[0]}
                    onChange={(e) => handlePlayerChange('team1', 0, e.target.value)}
                    placeholder="Player 1"
                    className="mt-2"
                  />
                  <Form.Control
                    type="text"
                    value={newMatch.team1.players[1]}
                    onChange={(e) => handlePlayerChange('team1', 1, e.target.value)}
                    placeholder="Player 2"
                    className="mt-2"
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Team 2 Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={newMatch.team2.name}
                    onChange={(e) => handleNewMatchChange('team2.name', e.target.value)}
                    placeholder="Enter team 2 name"
                  />
                  <Form.Control
                    type="text"
                    value={newMatch.team2.players[0]}
                    onChange={(e) => handlePlayerChange('team2', 0, e.target.value)}
                    placeholder="Player 1"
                    className="mt-2"
                  />
                  <Form.Control
                    type="text"
                    value={newMatch.team2.players[1]}
                    onChange={(e) => handlePlayerChange('team2', 1, e.target.value)}
                    placeholder="Player 2"
                    className="mt-2"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Button variant="primary" onClick={handleCreateMatch} className="w-100">
              Create Match
            </Button>
          </div>

          <div className="mt-4">
            <h4>Active Matches</h4>
            <Row>
              {matches.map(match => (
                <Col md={4} key={match.id} className="mb-3">
                  <Card>
                    <Card.Body>
                      <h5>Court {match.court}</h5>
                      <p className="mb-2">
                        {match.team1.name} vs {match.team2.name}
                      </p>
                      <p className="mb-2 small">
                        Score: {match.score.team1.sets}-{match.score.team2.sets} | 
                        {match.score.team1.games}-{match.score.team2.games}
                      </p>
                      <div className="d-grid gap-2">
                        <Button 
                          variant="primary" 
                          onClick={() => handleStartMatch(match.id)}
                        >
                          Continue Match
                        </Button>
                        <Button 
                          variant="danger" 
                          onClick={() => handleDeleteMatch(match.id)}
                        >
                          Delete Match
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>

          <div className="mt-4">
            <Button 
              variant="primary" 
              onClick={() => navigate('/summary')} 
              className="w-100"
            >
              View All Match Insights
            </Button>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default MatchSelection; 