import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, ButtonGroup, Card, Container, Row, Col, Form, Alert, Modal } from 'react-bootstrap';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const MatchTracker = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [matchData, setMatchData] = useState(null);
  const [currentMatchId, setCurrentMatchId] = useState(null);
  const [showPointWinnerModal, setShowPointWinnerModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMatch = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Get matchId from location state or localStorage
        const matchId = location.state?.matchId || localStorage.getItem('currentMatchId');
        
        if (!matchId) {
          setError('No match selected');
          setLoading(false);
          return;
        }

        setCurrentMatchId(matchId);
        
        // Fetch match data from Firestore
        const matchRef = doc(db, 'matches', matchId);
        const matchDoc = await getDoc(matchRef);
        
        if (!matchDoc.exists()) {
          setError('Match not found');
          setLoading(false);
          return;
        }

        setMatchData({ id: matchDoc.id, ...matchDoc.data() });
      } catch (error) {
        console.error('Error fetching match:', error);
        setError('Error loading match data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchMatch();
  }, [location.state]);

  const updateMatchInFirebase = async (updatedData) => {
    if (!currentMatchId) return;
    try {
      await updateDoc(doc(db, 'matches', currentMatchId), updatedData);
    } catch (error) {
      console.error('Error updating match:', error);
      alert('Error saving match data. Please try again.');
    }
  };

  const handleTeamNameChange = (team, value) => {
    if (!matchData) return;
    const updatedData = {
      ...matchData,
      [team]: { ...matchData[team], name: value }
    };
    setMatchData(updatedData);
    updateMatchInFirebase(updatedData);
  };

  const handlePlayerNameChange = (team, index, value) => {
    if (!matchData) return;
    const updatedData = {
      ...matchData,
      [team]: {
        ...matchData[team],
        players: matchData[team].players.map((player, i) => 
          i === index ? value : player
        )
      }
    };
    setMatchData(updatedData);
    updateMatchInFirebase(updatedData);
  };

  const getPointScore = (points) => {
    switch (points) {
      case 0: return '0';
      case 1: return '15';
      case 2: return '30';
      case 3: return '40';
      case 4: return 'AD';
      default: return '0';
    }
  };

  const handleServerChange = (team, player) => {
    if (!matchData) return;
    setMatchData(prev => ({
      ...prev,
      currentServer: team,
      currentPoint: {
        ...prev.currentPoint,
        servingTeam: team,
        servingPlayer: player,
        receivingTeam: team === 1 ? 2 : 1,
        receivingPlayer: 0
      }
    }));
  };

  const handleRecordPoint = () => {
    setShowPointWinnerModal(true);
  };

  const handlePointWinnerSelected = (winningTeam) => {
    setShowPointWinnerModal(false);
    handlePointScored(winningTeam);
  };

  const handlePointScored = async (winningTeam) => {
    if (!matchData) return;
    console.log('Point scored by team', winningTeam);
    console.log('Current game score before:', matchData.currentGame);
    console.log('Current set score before:', matchData.score);

    const newPoint = {
      ...matchData.currentPoint,
      result: winningTeam === matchData.currentPoint.servingTeam ? 'serving-team-won' : 'receiving-team-won',
      timestamp: new Date().toISOString()
    };

    // Check if this is an important point
    const isBreakPoint = matchData.currentPoint.servingTeam !== winningTeam && 
                        matchData.currentGame[`team${winningTeam}`] === 3;
    const isSetPoint = matchData.score[`team${winningTeam}`].games === 5 && 
                      matchData.currentGame[`team${winningTeam}`] === 3;
    const isMatchPoint = matchData.score[`team${winningTeam}`].sets === 1 && 
                        matchData.score[`team${winningTeam}`].games === 5 && 
                        matchData.currentGame[`team${winningTeam}`] === 3;

    if (isBreakPoint || isSetPoint || isMatchPoint) {
      newPoint.isBigPoint = true;
      newPoint.bigPointType = isMatchPoint ? 'match-point' : 
                             isSetPoint ? 'set-point' : 
                             'break-point';
    }

    // Switch server to the other player on the same team
    const newServingPlayer = matchData.currentPoint.servingPlayer === 0 ? 1 : 0;
    const newServingTeam = matchData.currentServer;
    const newReceivingTeam = newServingTeam === 1 ? 2 : 1;
    const newReceivingPlayer = matchData.currentPoint.receivingPlayer;

    // Update score
    const losingTeam = winningTeam === 1 ? 2 : 1;
    const newScore = { ...matchData.score };
    const newGame = { ...matchData.currentGame };

    // First, determine if this point wins the game
    const isGamePoint = 
      (newGame[`team${winningTeam}`] === 3 && newGame[`team${losingTeam}`] < 3) || // 40-0, 40-15, 40-30
      (newGame[`team${winningTeam}`] === 3 && newGame[`team${losingTeam}`] === 3); // Deuce

    if (isGamePoint) {
      // Win the game
      console.log('Game won by team', winningTeam);
      newScore[`team${winningTeam}`].games++;
      newGame[`team${winningTeam}`] = 0;
      newGame[`team${losingTeam}`] = 0;

      // Check for set win
      if (newScore[`team${winningTeam}`].games >= 6 && 
          (newScore[`team${winningTeam}`].games - newScore[`team${losingTeam}`].games >= 2)) {
        console.log('Set won by team', winningTeam);
        newScore[`team${winningTeam}`].sets++;
        newScore[`team${winningTeam}`].games = 0;
        newScore[`team${losingTeam}`].games = 0;
      }
    } else {
      // Regular point - just increment the score
      newGame[`team${winningTeam}`]++;
    }

    const updatedData = {
      ...matchData,
      points: [...matchData.points, newPoint],
      currentPoint: {
        servingTeam: newServingTeam,
        servingPlayer: newServingPlayer,
        receivingTeam: newReceivingTeam,
        receivingPlayer: newReceivingPlayer,
        serveDirection: '',
        formation: '',
        tactic: '',
        result: '',
        isBigPoint: false,
        bigPointType: '',
        rallyLength: 0,
        notes: ''
      },
      currentServer: newServingTeam,
      score: newScore,
      currentGame: newGame
    };

    setMatchData(updatedData);
    await updateMatchInFirebase(updatedData);
  };

  const handleUndoLastPoint = async () => {
    if (!matchData || matchData.points.length === 0) return;
    
    const newPoints = matchData.points.slice(0, -1);
    const lastPoint = matchData.points[matchData.points.length - 1];
    
    const updatedData = {
      ...matchData,
      points: newPoints,
      currentServer: lastPoint.servingTeam,
      currentPoint: {
        servingTeam: lastPoint.servingTeam,
        servingPlayer: lastPoint.servingPlayer,
        receivingTeam: lastPoint.receivingTeam,
        receivingPlayer: lastPoint.receivingPlayer,
        serveDirection: '',
        formation: '',
        tactic: '',
        result: '',
        isBigPoint: false,
        bigPointType: '',
        rallyLength: 0,
        notes: ''
      }
    };

    setMatchData(updatedData);
    await updateMatchInFirebase(updatedData);
  };

  const handleClearMatch = async () => {
    if (!matchData) return;
    if (window.confirm('Are you sure you want to clear all match data? This cannot be undone.')) {
      const updatedData = {
        ...matchData,
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

      setMatchData(updatedData);
      await updateMatchInFirebase(updatedData);
    }
  };

  const getScore = () => {
    if (!matchData) return '';
    const { score, currentGame } = matchData;
    const pointScore = `${getPointScore(currentGame.team1)}-${getPointScore(currentGame.team2)}`;
    return `${score.team1.sets}-${score.team2.sets} | ${score.team1.games}-${score.team2.games} | ${pointScore}`;
  };

  const getCurrentServer = () => {
    if (!matchData) return '';
    const team = matchData.currentServer === 1 ? matchData.team1 : matchData.team2;
    const player = matchData.currentPoint.servingPlayer === 0 ? team.players[0] : team.players[1];
    return `${team.name} - ${player}`;
  };

  const getCurrentReceiver = () => {
    if (!matchData) return '';
    const team = matchData.currentPoint.receivingTeam === 1 ? matchData.team1 : matchData.team2;
    const player = matchData.currentPoint.receivingPlayer === 0 ? team.players[0] : team.players[1];
    return `${team.name} - ${player}`;
  };

  if (loading) {
    return (
      <Container className="py-4">
        <Card>
          <Card.Body className="text-center">
            <h2>Loading Match...</h2>
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
            <Button variant="primary" onClick={() => navigate('/')} className="mt-3">
              Back to Match Selection
            </Button>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  if (!matchData) {
    return (
      <Container className="py-4">
        <Card>
          <Card.Body className="text-center">
            <h2>No Match Selected</h2>
            <Button variant="primary" onClick={() => navigate('/')} className="mt-3">
              Select a Match
            </Button>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <Card className="mb-4">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2>Tennis Scout</h2>
            <h4>Court {matchData.court}</h4>
          </div>
          
          <Row className="mb-4">
            <Col>
              <Form.Group>
                <Form.Label>Team 1 Name</Form.Label>
                <Form.Control
                  type="text"
                  value={matchData.team1.name}
                  onChange={(e) => handleTeamNameChange('team1', e.target.value)}
                  placeholder="Enter team 1 name"
                />
              </Form.Group>
              <Form.Group className="mt-2">
                <Form.Label>Team 1 Players</Form.Label>
                <Form.Control
                  type="text"
                  value={matchData.team1.players[0]}
                  onChange={(e) => handlePlayerNameChange('team1', 0, e.target.value)}
                  placeholder="Player 1"
                  className="mb-2"
                />
                <Form.Control
                  type="text"
                  value={matchData.team1.players[1]}
                  onChange={(e) => handlePlayerNameChange('team1', 1, e.target.value)}
                  placeholder="Player 2"
                />
              </Form.Group>
            </Col>
            <Col>
              <Form.Group>
                <Form.Label>Team 2 Name</Form.Label>
                <Form.Control
                  type="text"
                  value={matchData.team2.name}
                  onChange={(e) => handleTeamNameChange('team2', e.target.value)}
                  placeholder="Enter team 2 name"
                />
              </Form.Group>
              <Form.Group className="mt-2">
                <Form.Label>Team 2 Players</Form.Label>
                <Form.Control
                  type="text"
                  value={matchData.team2.players[0]}
                  onChange={(e) => handlePlayerNameChange('team2', 0, e.target.value)}
                  placeholder="Player 1"
                  className="mb-2"
                />
                <Form.Control
                  type="text"
                  value={matchData.team2.players[1]}
                  onChange={(e) => handlePlayerNameChange('team2', 1, e.target.value)}
                  placeholder="Player 2"
                />
              </Form.Group>
            </Col>
          </Row>

          <Alert variant="info" className="text-center mb-4">
            <div className="h4">Current Score: {getScore()}</div>
            <div className="small">Serving: {getCurrentServer()}</div>
            <div className="small">Receiving: {getCurrentReceiver()}</div>
          </Alert>

          <div className="mb-4">
            <h5>Select Server</h5>
            <Row>
              <Col>
                <h6>Team 1</h6>
                <ButtonGroup className="w-100">
                  <Button
                    variant={matchData.currentPoint.servingTeam === 1 && matchData.currentPoint.servingPlayer === 0 ? 'primary' : 'outline-primary'}
                    onClick={() => handleServerChange(1, 0)}
                    size="lg"
                  >
                    {matchData.team1.players[0] || 'Player 1'}
                  </Button>
                  <Button
                    variant={matchData.currentPoint.servingTeam === 1 && matchData.currentPoint.servingPlayer === 1 ? 'primary' : 'outline-primary'}
                    onClick={() => handleServerChange(1, 1)}
                    size="lg"
                  >
                    {matchData.team1.players[1] || 'Player 2'}
                  </Button>
                </ButtonGroup>
              </Col>
              <Col>
                <h6>Team 2</h6>
                <ButtonGroup className="w-100">
                  <Button
                    variant={matchData.currentPoint.servingTeam === 2 && matchData.currentPoint.servingPlayer === 0 ? 'primary' : 'outline-primary'}
                    onClick={() => handleServerChange(2, 0)}
                    size="lg"
                  >
                    {matchData.team2.players[0] || 'Player 1'}
                  </Button>
                  <Button
                    variant={matchData.currentPoint.servingTeam === 2 && matchData.currentPoint.servingPlayer === 1 ? 'primary' : 'outline-primary'}
                    onClick={() => handleServerChange(2, 1)}
                    size="lg"
                  >
                    {matchData.team2.players[1] || 'Player 2'}
                  </Button>
                </ButtonGroup>
              </Col>
            </Row>
          </div>

          <div className="mb-4">
            <h5>Serve Direction</h5>
            <div className="mb-2">
              <h6 className="text-center">Deuce Court</h6>
              <ButtonGroup className="w-100">
                <Button
                  variant={matchData.currentPoint.serveDirection === 'deuce-body-bh' ? 'primary' : 'outline-primary'}
                  onClick={() => setMatchData(prev => ({
                    ...prev,
                    currentPoint: { ...prev.currentPoint, serveDirection: 'deuce-body-bh' }
                  }))}
                  size="lg"
                >
                  Body BH
                </Button>
                <Button
                  variant={matchData.currentPoint.serveDirection === 'deuce-body-fh' ? 'primary' : 'outline-primary'}
                  onClick={() => setMatchData(prev => ({
                    ...prev,
                    currentPoint: { ...prev.currentPoint, serveDirection: 'deuce-body-fh' }
                  }))}
                  size="lg"
                >
                  Body FH
                </Button>
                <Button
                  variant={matchData.currentPoint.serveDirection === 'deuce-wide' ? 'primary' : 'outline-primary'}
                  onClick={() => setMatchData(prev => ({
                    ...prev,
                    currentPoint: { ...prev.currentPoint, serveDirection: 'deuce-wide' }
                  }))}
                  size="lg"
                >
                  Wide
                </Button>
                <Button
                  variant={matchData.currentPoint.serveDirection === 'deuce-t' ? 'primary' : 'outline-primary'}
                  onClick={() => setMatchData(prev => ({
                    ...prev,
                    currentPoint: { ...prev.currentPoint, serveDirection: 'deuce-t' }
                  }))}
                  size="lg"
                >
                  T
                </Button>
              </ButtonGroup>
            </div>
            <div>
              <h6 className="text-center">Ad Court</h6>
              <ButtonGroup className="w-100">
                <Button
                  variant={matchData.currentPoint.serveDirection === 'ad-body-bh' ? 'primary' : 'outline-primary'}
                  onClick={() => setMatchData(prev => ({
                    ...prev,
                    currentPoint: { ...prev.currentPoint, serveDirection: 'ad-body-bh' }
                  }))}
                  size="lg"
                >
                  Body BH
                </Button>
                <Button
                  variant={matchData.currentPoint.serveDirection === 'ad-body-fh' ? 'primary' : 'outline-primary'}
                  onClick={() => setMatchData(prev => ({
                    ...prev,
                    currentPoint: { ...prev.currentPoint, serveDirection: 'ad-body-fh' }
                  }))}
                  size="lg"
                >
                  Body FH
                </Button>
                <Button
                  variant={matchData.currentPoint.serveDirection === 'ad-wide' ? 'primary' : 'outline-primary'}
                  onClick={() => setMatchData(prev => ({
                    ...prev,
                    currentPoint: { ...prev.currentPoint, serveDirection: 'ad-wide' }
                  }))}
                  size="lg"
                >
                  Wide
                </Button>
                <Button
                  variant={matchData.currentPoint.serveDirection === 'ad-t' ? 'primary' : 'outline-primary'}
                  onClick={() => setMatchData(prev => ({
                    ...prev,
                    currentPoint: { ...prev.currentPoint, serveDirection: 'ad-t' }
                  }))}
                  size="lg"
                >
                  T
                </Button>
              </ButtonGroup>
            </div>
          </div>

          <div className="mb-4">
            <h5>Formation</h5>
            <ButtonGroup className="w-100">
              <Button
                variant={matchData.currentPoint.formation === 'regular' ? 'primary' : 'outline-primary'}
                onClick={() => setMatchData(prev => ({
                  ...prev,
                  currentPoint: { ...prev.currentPoint, formation: 'regular' }
                }))}
                size="lg"
              >
                Regular
              </Button>
              <Button
                variant={matchData.currentPoint.formation === 'mini-i' ? 'primary' : 'outline-primary'}
                onClick={() => setMatchData(prev => ({
                  ...prev,
                  currentPoint: { ...prev.currentPoint, formation: 'mini-i' }
                }))}
                size="lg"
              >
                Mini I
              </Button>
              <Button
                variant={matchData.currentPoint.formation === 'i-formation' ? 'primary' : 'outline-primary'}
                onClick={() => setMatchData(prev => ({
                  ...prev,
                  currentPoint: { ...prev.currentPoint, formation: 'i-formation' }
                }))}
                size="lg"
              >
                I Formation
              </Button>
            </ButtonGroup>
          </div>

          <div className="mb-4">
            <h5>Tactic</h5>
            <ButtonGroup className="w-100">
              <Button
                variant={matchData.currentPoint.tactic === 'serve-volley' ? 'primary' : 'outline-primary'}
                onClick={() => setMatchData(prev => ({
                  ...prev,
                  currentPoint: { ...prev.currentPoint, tactic: 'serve-volley' }
                }))}
                size="lg"
              >
                Serve & Volley
              </Button>
              <Button
                variant={matchData.currentPoint.tactic === 'stay-back' ? 'primary' : 'outline-primary'}
                onClick={() => setMatchData(prev => ({
                  ...prev,
                  currentPoint: { ...prev.currentPoint, tactic: 'stay-back' }
                }))}
                size="lg"
              >
                Stay Back
              </Button>
              <Button
                variant={matchData.currentPoint.tactic === 'poach' ? 'primary' : 'outline-primary'}
                onClick={() => setMatchData(prev => ({
                  ...prev,
                  currentPoint: { ...prev.currentPoint, tactic: 'poach' }
                }))}
                size="lg"
              >
                Poach
              </Button>
              <Button
                variant={matchData.currentPoint.tactic === 'fake-poach' ? 'primary' : 'outline-primary'}
                onClick={() => setMatchData(prev => ({
                  ...prev,
                  currentPoint: { ...prev.currentPoint, tactic: 'fake-poach' }
                }))}
                size="lg"
              >
                Fake Poach
              </Button>
            </ButtonGroup>
          </div>

          <div className="mb-4">
            <h5>Result</h5>
            <ButtonGroup className="w-100">
              <Button
                variant={matchData.currentPoint.result === 'ace' ? 'primary' : 'outline-primary'}
                onClick={() => setMatchData(prev => ({
                  ...prev,
                  currentPoint: { ...prev.currentPoint, result: 'ace' }
                }))}
                size="lg"
              >
                Ace
              </Button>
              <Button
                variant={matchData.currentPoint.result === 'return-winner' ? 'primary' : 'outline-primary'}
                onClick={() => setMatchData(prev => ({
                  ...prev,
                  currentPoint: { ...prev.currentPoint, result: 'return-winner' }
                }))}
                size="lg"
              >
                Return Winner
              </Button>
              <Button
                variant={matchData.currentPoint.result === 'return-error' ? 'primary' : 'outline-primary'}
                onClick={() => setMatchData(prev => ({
                  ...prev,
                  currentPoint: { ...prev.currentPoint, result: 'return-error' }
                }))}
                size="lg"
              >
                Return Error
              </Button>
              <Button
                variant={matchData.currentPoint.result === 'poach' ? 'primary' : 'outline-primary'}
                onClick={() => setMatchData(prev => ({
                  ...prev,
                  currentPoint: { ...prev.currentPoint, result: 'poach' }
                }))}
                size="lg"
              >
                Poach
              </Button>
              <Button
                variant={matchData.currentPoint.result === 'rally' ? 'primary' : 'outline-primary'}
                onClick={() => setMatchData(prev => ({
                  ...prev,
                  currentPoint: { ...prev.currentPoint, result: 'rally' }
                }))}
                size="lg"
              >
                Rally
              </Button>
            </ButtonGroup>
          </div>

          <div className="mb-4">
            <h5>Point Importance</h5>
            <Button
              variant={matchData.currentPoint.isBigPoint ? 'warning' : 'outline-warning'}
              size="lg"
              className="w-100"
              onClick={() => setMatchData(prev => ({
                ...prev,
                currentPoint: { 
                  ...prev.currentPoint, 
                  isBigPoint: !prev.currentPoint.isBigPoint,
                  bigPointType: !prev.currentPoint.isBigPoint ? 'manual' : ''
                }
              }))}
            >
              {matchData.currentPoint.isBigPoint ? 
                `⭐ Big Point${matchData.currentPoint.bigPointType ? ` (${matchData.currentPoint.bigPointType.replace('-', ' ').toUpperCase()})` : ''}` : 
                'Mark as Big Point'}
            </Button>
          </div>

          <div className="mb-4">
            <h5>Point Winner</h5>
            <Row>
              <Col>
                <Button
                  variant="success"
                  size="lg"
                  className="w-100 py-4"
                  onClick={() => handlePointScored(1)}
                  disabled={!matchData.currentPoint.serveDirection || !matchData.currentPoint.formation || !matchData.currentPoint.tactic || !matchData.currentPoint.result}
                >
                  {matchData.team1.name || 'Team 1'} Won
                </Button>
              </Col>
              <Col>
                <Button
                  variant="success"
                  size="lg"
                  className="w-100 py-4"
                  onClick={() => handlePointScored(2)}
                  disabled={!matchData.currentPoint.serveDirection || !matchData.currentPoint.formation || !matchData.currentPoint.tactic || !matchData.currentPoint.result}
                >
                  {matchData.team2.name || 'Team 2'} Won
                </Button>
              </Col>
            </Row>
          </div>

          <div className="mt-5 p-3 bg-light rounded">
            <h4 className="text-center mb-4">Match Controls</h4>
            <div className="d-grid gap-3">
              <Button
                variant="danger"
                size="lg"
                className="py-3"
                onClick={handleUndoLastPoint}
                disabled={matchData.points.length === 0}
              >
                ⏪ Undo Last Point
              </Button>
              <Button
                variant="danger"
                size="lg"
                className="py-3"
                onClick={handleClearMatch}
              >
                🗑️ Clear Match Data
              </Button>
              <Button
                variant="primary"
                size="lg"
                className="py-3"
                onClick={() => navigate('/summary')}
              >
                📊 View Tactical Summary
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="py-3"
                onClick={() => navigate('/')}
              >
                ← Back to Match Selection
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default MatchTracker; 