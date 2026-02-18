import React from 'react';
import { Typography, Box, Card, CardContent, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import { TrendingUp, Schedule, Article, Settings } from '@mui/icons-material';

const DashboardPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Welcome to your social media management dashboard
      </Typography>

      {/* Metrics Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 3, mb: 3 }}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Article sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
              <Box>
                <Typography variant="h4">0</Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Posts
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Schedule sx={{ fontSize: 40, color: 'warning.main', mr: 2 }} />
              <Box>
                <Typography variant="h4">0</Typography>
                <Typography variant="body2" color="text.secondary">
                  Scheduled
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <TrendingUp sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
              <Box>
                <Typography variant="h4">0</Typography>
                <Typography variant="body2" color="text.secondary">
                  Engagements
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Settings sx={{ fontSize: 40, color: 'info.main', mr: 2 }} />
              <Box>
                <Typography variant="h4">0</Typography>
                <Typography variant="body2" color="text.secondary">
                  Connected Accounts
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Quick Actions */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Quick Actions
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              component={Link}
              to="/dashboard/composer"
            >
              Create Post
            </Button>
            <Button
              variant="outlined"
              component={Link}
              to="/dashboard/integration"
            >
              Manage Integrations
            </Button>
            <Button
              variant="outlined"
              component={Link}
              to="/dashboard/analytics"
            >
              View Analytics
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Recent Activity
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No recent activity. Start by connecting your social media accounts and creating your first post!
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DashboardPage;
