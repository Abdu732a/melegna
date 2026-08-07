import db from './sqlite';

export const getLocalMenu = () => {
    return db.getAllSync('SELECT * FROM local_menu WHERE isAvailable = 1');
};

export const saveMenuToLocal = (menuItems: any[]) => {
    const statement = db.prepareSync(
        'INSERT OR REPLACE INTO local_menu (id, nameAmharic, nameEnglish, category, price, imageUrl, isAvailable) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    try {
        for (const item of menuItems) {
            statement.executeSync([
                item._id || item.id,
                item.nameAmharic,
                item.nameEnglish,
                item.category,
                item.price,
                item.imageUrl || '',
                item.isAvailable ? 1 : 0
            ]);
        }
    } finally {
        statement.finalizeSync();
    }
};