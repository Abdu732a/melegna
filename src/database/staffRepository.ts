import db from './sqlite';

export const getLocalStaff = () => {
    return db.getAllSync('SELECT * FROM local_users WHERE isActive = 1');
};

export const saveStaffToLocal = (staffList: any[]) => {
    const statement = db.prepareSync(
        'INSERT OR REPLACE INTO local_users (id, name, role, pinCodeHash, isActive) VALUES (?, ?, ?, ?, ?)'
    );
    try {
        for (const user of staffList) {
            statement.executeSync([
                user._id || user.id,
                user.name,
                user.role,
                user.pinCodeHash || '',
                user.isActive ? 1 : 0
            ]);
        }
    } finally {
        statement.finalizeSync();
    }
};