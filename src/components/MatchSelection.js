import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Button, Row, Col, Form, ListGroup } from 'react-bootstrap';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, onSnapshot } from 'firebase/firestore';

const MatchSelection = () => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newMatch, setNewMatch] = useState({
    court: '',
    team1: { name: '', players: ['', ''] },
    team2: { name: '', players: ['', ''] }
  });

  useEffect(() => {
    let unsubscribe;
    
    const setupFirestoreListener = async () => {
      try {
        console.log('Starting to fetch matches...');
        setLoading(true);
        setError(null);

        const matchesRef = collection(db, 'matches');
        console.log('Collection reference created:', matchesRef);

        unsubscribe = onSnapshot(
          matchesRef,
          (snapshot) => {
            console.log('Received snapshot with', snapshot.docs.length, 'documents');
            const matchesList = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            console.log('Processed matches:', matchesList);
            setMatches(matchesList);
            setLoading(false);
          },
          (error) => {
            console.error('Error in Firestore listener:', error);
            setError('Error loading matches. Please try again.');
            setLoading(false);
          }
        );

        console.log('Firestore listener set up successfully');
      } catch (error) {
        console.error('Error setting up Firestore listener:', error);
        setError('Error connecting to database. Please try again.');
        setLoading(false);
      }
    };

    setupFirestoreListener();

    return () => {
      if (unsubscribe) {
        console.log('Cleaning up Firestore listener');
        unsubscribe();
      }
    };
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

  const handleCreateMatch = useCallback(async (e) => {
    e.preventDefault();
    if (isCreating) return;
    
    console.log('Starting match creation with data:', newMatch);
    setIsCreating(true);
    
    try {
      // Validate required fields
      if (!newMatch.court || !newMatch.team1.name || !newMatch.team2.name) {
        throw new Error('Please fill in all required fields (Court, Team 1 Name, and Team 2 Name)');
      }

      // Create the match data object
      const matchData = {
        ...newMatch,
        createdAt: new Date().toISOString(),
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
        }
      };

      console.log('Attempting to add document to Firestore with data:', matchData);
      
      const matchesRef = collection(db, 'matches');
      const docRef = await addDoc(matchesRef, matchData);
      console.log('Match created successfully with ID:', docRef.id);

      // Reset form
      setNewMatch({
        court: '',
        team1: { name: '', players: ['', ''] },
        team2: { name: '', players: ['', ''] }
      });

      // Navigate to the match tracker
      navigate('/match', { state: { matchId: docRef.id } });
    } catch (error) {
      console.error('Detailed error creating match:', error);
      alert(`Error creating match: ${error.message || 'Please try again.'}`);
    } finally {
      setIsCreating(false);
    }
  }, [newMatch, navigate, isCreating]);

  const handleDeleteMatch = useCallback(async (matchId) => {
    if (window.confirm('Are you sure you want to delete this match?')) {
      try {
        await deleteDoc(doc(db, 'matches', matchId));
      } catch (error) {
        console.error('Error deleting match:', error);
        alert('Error deleting match. Please try again.');
      }
    }
  }, []);

  const handleStartMatch = useCallback((matchId) => {
    navigate('/match', { state: { matchId } });
  }, [navigate]);

  const matchesList = useMemo(() => (
    <ListGroup>
      {matches.map(match => (
        <ListGroup.Item key={match.id} className="d-flex justify-content-between align-items-center">
          <div>
            <strong>Court {match.court}</strong>
            <div className="small">
              {match.team1.name} vs {match.team2.name}
            </div>
          </div>
          <div>
            <Button
              variant="primary"
              className="me-2"
              onClick={() => handleStartMatch(match.id)}
            >
              Continue Match
            </Button>
            <Button
              variant="danger"
              onClick={() => handleDeleteMatch(match.id)}
            >
              Delete
            </Button>
          </div>
        </ListGroup.Item>
      ))}
    </ListGroup>
  ), [matches, handleStartMatch, handleDeleteMatch]);

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
                    disabled={isCreating}
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
                    disabled={isCreating}
                  />
                  <Form.Control
                    type="text"
                    value={newMatch.team1.players[0]}
                    onChange={(e) => handlePlayerChange('team1', 0, e.target.value)}
                    placeholder="Player 1"
                    className="mt-2"
                    disabled={isCreating}
                  />
                  <Form.Control
                    type="text"
                    value={newMatch.team1.players[1]}
                    onChange={(e) => handlePlayerChange('team1', 1, e.target.value)}
                    placeholder="Player 2"
                    className="mt-2"
                    disabled={isCreating}
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
                    disabled={isCreating}
                  />
                  <Form.Control
                    type="text"
                    value={newMatch.team2.players[0]}
                    onChange={(e) => handlePlayerChange('team2', 0, e.target.value)}
                    placeholder="Player 1"
                    className="mt-2"
                    disabled={isCreating}
                  />
                  <Form.Control
                    type="text"
                    value={newMatch.team2.players[1]}
                    onChange={(e) => handlePlayerChange('team2', 1, e.target.value)}
                    placeholder="Player 2"
                    className="mt-2"
                    disabled={isCreating}
                  />
                </Form.Group>
              </Col>
            </Row>
            <Button 
              variant="primary" 
              onClick={handleCreateMatch} 
              className="w-100"
              disabled={isCreating}
            >
              {isCreating ? 'Creating Match...' : 'Create Match'}
            </Button>
          </div>

          <div className="mt-4">
            <h4>Active Matches</h4>
            {loading ? (
              <div className="text-center">Loading matches...</div>
            ) : error ? (
              <div className="text-danger">{error}</div>
            ) : (
              matchesList
            )}
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

export default React.memo(MatchSelection); 