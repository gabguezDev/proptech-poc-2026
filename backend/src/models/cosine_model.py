import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity


class CosineRecommender:

  def __init__(self, feature_cols: list):
    self.feature_cols = feature_cols

  def predict(
      self, df_properties: pd.DataFrame, user_vector: list
  ) -> pd.DataFrame:
    X_properties = df_properties[self.feature_cols].values
    user_matrix = np.array([user_vector])

    scores = cosine_similarity(user_matrix, X_properties)[0]

    df_result = df_properties.copy()
    df_result["score_compatibilidad"] = (scores * 100).round(2)
    return df_result.sort_values(by="score_compatibilidad", ascending=False)