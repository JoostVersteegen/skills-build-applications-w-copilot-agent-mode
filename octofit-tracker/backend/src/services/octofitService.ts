import mongoose from 'mongoose';
import { Activity, Team, User, Workout } from '../models/index.js';

function badRequest(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(input: unknown) {
  if (!input || typeof input !== 'object') {
    throw badRequest('Activity payload is required');
  }

  const { userId, teamId, type, minutes } = input as Record<string, unknown>;
  const normalizedType = typeof type === 'string' ? type.trim() : '';
  const numericMinutes = Number(minutes);

  if (!userId || !teamId || !normalizedType || !Number.isFinite(numericMinutes) || numericMinutes <= 0) {
    throw badRequest('userId, teamId, type, and minutes are required');
  }
  if (!mongoose.isValidObjectId(String(userId)) || !mongoose.isValidObjectId(String(teamId))) {
    throw badRequest('userId and teamId must be valid ObjectIds');
  }

  const [user, team] = await Promise.all([
    User.findById(userId),
    Team.findById(teamId),
  ]);

  if (!user || !team) {
    throw badRequest('userId and teamId must reference existing records');
  }

  const activity = await Activity.create({
    user: user._id,
    team: team._id,
    type: normalizedType,
    minutes: numericMinutes,
    points: numericMinutes,
    occurredAt: new Date(),
  });

  return activity.toObject();
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(input: unknown) {
  if (!input || typeof input !== 'object') {
    throw badRequest('Team payload is required');
  }

  const { name, mascot, members } = input as Record<string, unknown>;
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedMascot = typeof mascot === 'string' ? mascot.trim() : '';

  if (!normalizedName || !normalizedMascot) {
    throw badRequest('name and mascot are required');
  }
  if (members !== undefined && !Array.isArray(members)) {
    throw badRequest('members must be an array of user IDs');
  }

  const memberIds = (members ?? []).map(String);
  if (memberIds.some((memberId) => !mongoose.isValidObjectId(memberId))) {
    throw badRequest('members must contain valid user IDs');
  }
  if (memberIds.length > 0) {
    const existingMembers = await User.find({ _id: { $in: memberIds } }).select('_id').lean();
    const existingIds = new Set(existingMembers.map((member) => member._id.toString()));
    if (memberIds.some((memberId) => !existingIds.has(memberId))) {
      throw badRequest('members must reference existing users');
    }
  }

  const team = await Team.create({
    name: normalizedName,
    mascot: normalizedMascot,
    members: memberIds,
  });
  return team.toObject();
}

export async function getLeaderboard() {
  const [teams, pointTotals] = await Promise.all([
    Team.find().select('name').lean(),
    Activity.aggregate<{ _id: mongoose.Types.ObjectId; totalPoints: number }>([
      { $group: { _id: '$team', totalPoints: { $sum: '$points' } } },
    ]),
  ]);
  const totalsByTeam = new Map(pointTotals.map(({ _id, totalPoints }) => [_id.toString(), totalPoints]));
  const leaderboard = teams
    .map((team) => ({
      teamName: team.name,
      totalPoints: totalsByTeam.get(team._id.toString()) ?? 0,
    }))
    .sort((left, right) => right.totalPoints - left.totalPoints || left.teamName.localeCompare(right.teamName));

  return leaderboard.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail.trim().toLowerCase() }).select('fitnessGoal').lean();
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const recentActivity = await Activity.findOne({ user: user._id }).sort({ occurredAt: -1 }).select('type').lean();
  const focus = user.fitnessGoal?.trim() || recentActivity?.type?.trim();
  if (!focus) return [];

  const workouts = await Workout.find().lean();
  const matchingWorkouts = workouts.filter((workout) => workout.focus.toLowerCase() === focus.toLowerCase());
  const reason = user.fitnessGoal?.trim()
    ? `Matches your ${focus} fitness goal.`
    : `Recommended based on your recent ${focus} activity.`;

  return matchingWorkouts.map((workout) => ({ ...workout, reason }));
}

export { User };
