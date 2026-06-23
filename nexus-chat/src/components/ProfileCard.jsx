import React from 'react';

const ProfileCard = ({ user, isMe, onEdit, onVerify }) => {
  const maxPhotos = user.premium ? 10 : 3;
  const photos = user.photos || [];

  return (
    <div className="profile-card">
      <div className="hero">
        {photos[0] ? (
          <img src={photos[0]} alt={user.name} />
        ) : (
          <div className="avatar-placeholder" style={{ backgroundColor: user.avatarColor }}>
            {user.name?.[0]}
          </div>
        )}
        <div className="hero-info">
          <h2>{user.name} {user.verified && '✅'}</h2>
          <p>{user.age} ans • {user.city}</p>
          {user.premium && <span className="badge-premium">PREMIUM</span>}
        </div>
      </div>

      <div className="content">
        <p className="bio">{user.bio}</p>

        <div className="interests">
          {user.interests?.map(i => (
            <span key={i} className="tag">#{i}</span>
          ))}
        </div>

        <div className="album">
          <h3>Album Media ({photos.length}/{maxPhotos})</h3>
          <div className="grid">
            {photos.map((p, i) => (
              <img key={i} src={p} alt="" />
            ))}
            {photos.length < maxPhotos && isMe && (
              <div className="add-photo">Add</div>
            )}
          </div>
        </div>

        {isMe && (
          <div className="actions">
            <button onClick={onEdit}>Edit Profile</button>
            {!user.verified && <button onClick={onVerify}>Verify Phone</button>}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileCard;
